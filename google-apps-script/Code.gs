/**
 * Bartholomew — Automatic Meeting Notes Redaction
 *
 * One-time setup:
 *   1. Open script.google.com, create a new project, paste this file.
 *   2. Set Script Properties (Project Settings → Script properties):
 *        BART_URL         — https://bart2-production.up.railway.app
 *        BART_TOKEN       — your Bartholomew JWT (log in, copy from localStorage key "token")
 *        NOTES_FOLDER_ID  — Drive folder ID where Gemini saves notes (leave blank to search all Drive)
 *        OUTPUT_FOLDER_ID — Drive folder ID for redacted docs (leave blank = same folder as original)
 *   3. Run setupTrigger() once to install the 5-minute automatic trigger.
 */

// ── Configuration ──────────────────────────────────────────────────────────────

var PROPS = PropertiesService.getScriptProperties();

function bartUrl()          { return PROPS.getProperty('BART_URL') || ''; }
function bartToken()        { return PROPS.getProperty('BART_TOKEN') || ''; }
function notesFolderId()    { return PROPS.getProperty('NOTES_FOLDER_ID') || ''; }
function outputFolderId()   { return PROPS.getProperty('OUTPUT_FOLDER_ID') || ''; }

// Drive file property key used to mark docs as already processed
var PROCESSED_KEY = 'bart_processed';

// ── Trigger setup ──────────────────────────────────────────────────────────────

/**
 * Run this function ONCE to install the recurring trigger.
 * Running it again is safe — it checks for duplicates first.
 */
function setupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkForNewNotes') {
      Logger.log('Trigger already exists, skipping creation.');
      return;
    }
  }
  ScriptApp.newTrigger('checkForNewNotes')
    .timeBased()
    .everyMinutes(5)
    .create();
  Logger.log('Trigger created: checkForNewNotes every 5 minutes.');
}

/**
 * Remove all triggers for checkForNewNotes (if you want to disable).
 */
function removeTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkForNewNotes') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('Trigger removed.');
    }
  }
}

// ── Main loop ──────────────────────────────────────────────────────────────────

/**
 * Called automatically every 5 minutes (or manually for testing).
 * Finds new, unprocessed Gemini meeting notes and redacts them.
 */
function checkForNewNotes() {
  var url  = bartUrl();
  var token = bartToken();
  if (!url || !token) {
    Logger.log('ERROR: BART_URL and BART_TOKEN script properties must be set.');
    return;
  }

  var files = findNewNoteFiles();
  Logger.log('Found ' + files.length + ' unprocessed note file(s).');

  for (var i = 0; i < files.length; i++) {
    try {
      processFile(files[i], url, token);
    } catch (e) {
      Logger.log('ERROR processing file "' + files[i].getName() + '": ' + e);
    }
  }
}

// ── File discovery ─────────────────────────────────────────────────────────────

/**
 * Returns Drive Files (Google Docs) that look like Gemini meeting notes
 * and have not yet been processed by Bartholomew.
 */
function findNewNoteFiles() {
  var folderId = notesFolderId();
  var tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  var results = [];

  if (folderId) {
    // Search within the specified folder only
    var folder = DriveApp.getFolderById(folderId);
    var iter = folder.getFilesByType(MimeType.GOOGLE_DOCS);
    while (iter.hasNext()) {
      var f = iter.next();
      if (isUnprocessedNoteFile(f, tenMinutesAgo)) {
        results.push(f);
      }
    }
  } else {
    // Search all of Drive for recently modified Gemini-style note docs
    var query = 'mimeType = "application/vnd.google-apps.document"'
      + ' and (title contains "Notes from" or title contains "Meeting Notes")'
      + ' and modifiedDate > "' + tenMinutesAgo.toISOString() + '"';
    var search = DriveApp.searchFiles(query);
    while (search.hasNext()) {
      var f = search.next();
      if (isUnprocessedNoteFile(f, tenMinutesAgo)) {
        results.push(f);
      }
    }
  }

  return results;
}

/**
 * Returns true if the file has not been processed and was modified recently.
 */
function isUnprocessedNoteFile(file, since) {
  // Skip already-processed docs
  if (file.getProperty(PROCESSED_KEY) === 'true') return false;
  // Only consider docs modified within the window
  if (file.getLastUpdated() < since) return false;
  return true;
}

// ── Processing ─────────────────────────────────────────────────────────────────

function processFile(file, bartBaseUrl, token) {
  var fileId = file.getId();
  var originalTitle = file.getName();

  Logger.log('Processing: "' + originalTitle + '" (' + fileId + ')');

  // Read body text
  var body = DocumentApp.openById(fileId).getBody().getText();
  if (!body.trim()) {
    Logger.log('Skipping empty doc: ' + originalTitle);
    DriveApp.getFileById(fileId).setProperty(PROCESSED_KEY, 'true');
    return;
  }

  // Call Bartholomew redaction endpoint
  var response = UrlFetchApp.fetch(bartBaseUrl + '/api/reviews/redact', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + token },
    payload: JSON.stringify({ content: body, source: 'google_meet_gemini' }),
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('Bartholomew API returned HTTP ' + code + ': ' + response.getContentText());
  }

  var redactedText = JSON.parse(response.getContentText()).redacted;

  // Determine output folder
  var outputFolder;
  var outFolderId = outputFolderId();
  if (outFolderId) {
    outputFolder = DriveApp.getFolderById(outFolderId);
  } else {
    var parents = file.getParents();
    outputFolder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  }

  // Create new Google Doc with redacted content
  var newTitle = '[Redacted] ' + originalTitle;
  var newDoc = DocumentApp.create(newTitle);
  newDoc.getBody().setText(redactedText);
  newDoc.saveAndClose();

  // Move the new doc to the output folder (it's created in root by default)
  var newFile = DriveApp.getFileById(newDoc.getId());
  outputFolder.addFile(newFile);
  DriveApp.getRootFolder().removeFile(newFile);

  // Mark original as processed
  DriveApp.getFileById(fileId).setProperty(PROCESSED_KEY, 'true');

  Logger.log('Created redacted doc: "' + newTitle + '"');
}
