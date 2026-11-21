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
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
    stdio: "inherit",
  });
  execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], {
    stdio: "inherit",
  });
};
