export default function Guide() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">User Guide</h1>
        <p className="text-zinc-500 mt-1 text-sm">
          Everything you need to know about Bartholomew
        </p>
      </div>

      {/* About */}
      <section className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-3">
        <h2 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
          <span>🤗</span> What is Bartholomew?
        </h2>
        <p className="text-zinc-600 text-sm leading-relaxed">
          Bartholomew is an AI-powered marketing content reviewer built for NEAR Foundation.
          Its purpose is to help teams ensure that marketing copies, announcements,
          social media posts, and other communications are aligned with NEAR's brand guidelines
          and communications policy before they are published.
        </p>
        <p className="text-zinc-600 text-sm leading-relaxed">
          The tool analyses submitted content across several dimensions — brand alignment, regulatory
          compliance, sentiment, and readability — and provides a structured report with a suggested
          rewrite where applicable.
        </p>
      </section>

      {/* How to submit */}
      <section className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-800">📤 How to Submit Material</h2>
        <ol className="space-y-3 text-sm text-zinc-600">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-near-green text-near-dark rounded-full flex items-center justify-center font-bold text-xs">1</span>
            <span>
              Click <strong>New Review</strong> in the sidebar to open the submission form.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-near-green text-near-dark rounded-full flex items-center justify-center font-bold text-xs">2</span>
            <span>
              Select the <strong>content type</strong> that best describes your material — for example,
              Social Post, Press Release, Blog Post, or Email.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-near-green text-near-dark rounded-full flex items-center justify-center font-bold text-xs">3</span>
            <span>
              Paste or type your content in the text area, or upload a file (PDF, Word, or plain text).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-near-green text-near-dark rounded-full flex items-center justify-center font-bold text-xs">4</span>
            <span>
              Choose the <strong>jurisdiction</strong> if the content targets a specific regulatory
              environment (e.g. EU, US, or General).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-near-green text-near-dark rounded-full flex items-center justify-center font-bold text-xs">5</span>
            <span>
              Click <strong>Submit for Review</strong>. The AI will analyse your content — this
              typically takes 15–30 seconds.
            </span>
          </li>
        </ol>
      </section>

      {/* How to read results */}
      <section className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-800">📊 How to Read the Results</h2>
        <div className="space-y-4 text-sm text-zinc-600">
          <div>
            <p className="font-medium text-zinc-800 mb-1">Overall Rating</p>
            <p className="leading-relaxed">
              The review opens with an <strong>overall rating</strong> (Approved / Needs Revision /
              Rejected) and a brief plain-language summary of the key findings.
            </p>
          </div>
          <div>
            <p className="font-medium text-zinc-800 mb-1">Brand Score</p>
            <p className="leading-relaxed">
              A score from 0 to 100 measuring how closely the content reflects NEAR's brand voice,
              messaging pillars, and tone-of-voice guidelines. Scores above 80 generally indicate
              strong alignment.
            </p>
          </div>
          <div>
            <p className="font-medium text-zinc-800 mb-1">Compliance Flags</p>
            <p className="leading-relaxed">
              Any phrases, claims, or statements that may raise regulatory or legal concerns are
              listed here, along with the reason and the relevant jurisdiction. Each flag should
              be reviewed and addressed before publication.
            </p>
          </div>
          <div>
            <p className="font-medium text-zinc-800 mb-1">Sentiment</p>
            <p className="leading-relaxed">
              The detected emotional tone of the content (Positive, Neutral, or Negative) together
              with a sentiment score and a short explanation. This helps ensure the message lands
              as intended with the target audience.
            </p>
          </div>
          <div>
            <p className="font-medium text-zinc-800 mb-1">Suggested Rewrite</p>
            <p className="leading-relaxed">
              Where improvements are recommended, Bartholomew provides a complete rewritten version
              of your content that incorporates the feedback. You may use this as-is or as a
              starting point for your own edits.
            </p>
          </div>
        </div>
      </section>

      {/* Legal disclaimer */}
      <section className="bg-amber-50 rounded-2xl border border-amber-200 p-6 space-y-3">
        <h2 className="text-lg font-semibold text-amber-900 flex items-center gap-2">
          <span>⚠️</span> Legal Disclaimer
        </h2>
        <p className="text-amber-800 text-sm leading-relaxed">
          Bartholomew is an AI-assisted tool designed to support — not replace — the review
          process carried out by NEAR Foundation's legal and communications teams.
        </p>
        <p className="text-amber-800 text-sm leading-relaxed">
          An "Approved" result from Bartholomew does not constitute final legal clearance.
          The Legal Department reserves the right to review, revise, or withhold approval of any
          content regardless of the tool's output. All material that is subject to regulatory
          requirements, financial promotions rules, or other legal obligations must continue to
          follow the standard review and sign-off process.
        </p>
        <p className="text-amber-800 text-sm leading-relaxed">
          If you have any questions about whether your content requires additional review, please
          contact the Legal team before publication.
        </p>
      </section>
    </div>
  );
}
