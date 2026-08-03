const { autoUpdater } = require('electron-updater');
const { app, dialog } = require('electron');

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function initializeAutoUpdater() {
  // Skip in development — no app-update.yml until packaged.
  if (!app.isPackaged) return;

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Gặp lỗi trong quá trình cập nhật:', err);
  });

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Cập nhật hoàn tất',
      message: `Phiên bản mới (${info.version}) đã được tải xuống thành công. Bạn có muốn khởi động lại ứng dụng ngay bây giờ để áp dụng bản cập nhật không?`,
      buttons: ['Khởi động lại ngay', 'Để sau'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('[AutoUpdater] Lỗi khi gọi checkForUpdatesAndNotify:', err);
  });
}

module.exports = { initializeAutoUpdater };
