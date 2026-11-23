const { execFileSync } = require("node:child_process");
const path = require("node:path");

/**
 * Ad-hoc code signature for macOS builds.
 *
 * Apple Silicon refuses to launch an app bundle that is not code signed, and
 * macOS reports it as "damaged". We do not have a Developer ID certificate, so
 * we sign every bundle ad-hoc (`codesign --sign -`). This makes the app valid
 * locally; users still have to allow it the first time (right-click → Open).
 */
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );

  console.log(`  • ad-hoc signing ${appPath}`);

  // codesign can occasionally hit a transient "internal error in Code Signing
  // subsystem" on CI/desktop machines. Retry a few times before failing.
  const runWithRetry = (args, attempts = 3) => {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        execFileSync("codesign", args, { stdio: "inherit" });
        return;
      } catch (error) {
        if (attempt === attempts) throw error;
        console.log(`  • codesign failed (attempt ${attempt}/${attempts}), retrying…`);
        execFileSync("sleep", ["1"]);
      }
    }
  };

  runWithRetry(["--force", "--deep", "--sign", "-", appPath]);
  runWithRetry(["--verify", "--deep", "--strict", appPath]);
};
