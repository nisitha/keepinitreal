const ftp = require("basic-ftp");
const path = require("path");
require("dotenv").config({ path: ".env.local" });

async function deploy() {
  const client = new ftp.Client();
  client.ftp.verbose = true; // හරියටම files යනවා පේන්න

  try {
    console.log("🚀 Connecting to FTP Server...");
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      secure: false
    });

    console.log(" Connected!");
    
    // Remote path එකට යමු
    const targetDir = process.env.FTP_REMOTE_DIR || "/keepinitreal.us/www";
    console.log(`📂 Ensuring remote directory: ${targetDir}`);
    await client.ensureDir(targetDir);
    await client.cd(targetDir);

    console.log("⬆️ Uploading all built files from 'out'...");
    const localDir = path.join(__dirname, "out");

    // Skip නොකර direct overwrite කරනවා
    await client.uploadFromDir(localDir);

    console.log("✅ Deployment complete! All files refreshed on server.");
  } catch (err) {
    console.error("❌ Deployment failed:", err);
  } finally {
    client.close();
  }
}

deploy();