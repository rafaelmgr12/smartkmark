exports.default = async function notarizeBuild(context) {
  const { notarize } = await import('@electron/notarize');
  const { electronPlatformName, appOutDir, packager } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appleId = process.env.APPLE_ID;
  const applePassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !applePassword || !teamId) {
    console.log(
      '[notarize] Skipping macOS notarization because APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, or APPLE_TEAM_ID is missing.'
    );
    return;
  }

  await notarize({
    appBundleId: packager.appInfo.id,
    appPath: `${appOutDir}/${appName}.app`,
    appleId,
    appleIdPassword: applePassword,
    teamId,
  });
};
