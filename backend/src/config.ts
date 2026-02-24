import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

export const config = {
  databasePath: process.env.DATABASE_PATH || "/tmp/bart2.db",
  secretKey: process.env.SECRET_KEY || "dev-secret-key",
  accessTokenExpireHours: 24,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:8000").split(","),
  port: parseInt(process.env.PORT || "8000"),
};
