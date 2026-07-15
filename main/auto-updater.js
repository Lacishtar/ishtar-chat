const { autoUpdater } = require('electron-updater');
const { app, dialog } = require('electron');

// Tự động tải bản cập nhật trong nền và tự động cài đặt khi thoát
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function initializeAutoUpdater() {
  // Chỉ chạy trình tự động cập nhật khi ứng dụng đã đóng gói (packaged)
  // Tránh lỗi thiếu cấu hình app-update.yml trong quá trình phát triển (development)
  if (!app.isPackaged) {
    console.log('[AutoUpdater] Bỏ qua: Ứng dụng đang chạy ở chế độ Development.');
    return;
  }

  console.log('[AutoUpdater] Bắt đầu khởi tạo hệ thống tự động cập nhật...');

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Đang kiểm tra bản cập nhật mới...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Phát hiện bản cập nhật mới:', info.version);
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] Ứng dụng hiện tại đã là phiên bản mới nhất.', info.version);
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Gặp lỗi trong quá trình cập nhật:', err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let logMessage = `Đang tải: ${progressObj.percent.toFixed(2)}%`;
    logMessage += ` (${(progressObj.transferred / 1024 / 1024).toFixed(2)}MB / ${(progressObj.total / 1024 / 1024).toFixed(2)}MB)`;
    console.log('[AutoUpdater]', logMessage);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Bản cập nhật đã được tải xuống hoàn tất:', info.version);

    // Hiển thị Dialog thông báo và hỏi người dùng có muốn khởi động lại ngay lập tức để áp dụng cập nhật
    dialog.showMessageBox({
      type: 'info',
      title: 'Cập nhật hoàn tất',
      message: `Phiên bản mới (${info.version}) đã được tải xuống thành công. Bạn có muốn khởi động lại ứng dụng ngay bây giờ để áp dụng bản cập nhật không?`,
      buttons: ['Khởi động lại ngay', 'Để sau'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        console.log('[AutoUpdater] Người dùng đồng ý. Tiến hành cài đặt và khởi động lại...');
        autoUpdater.quitAndInstall();
      } else {
        console.log('[AutoUpdater] Người dùng chọn để sau. Bản cập nhật sẽ được cài đặt khi thoát ứng dụng.');
      }
    });
  });

  // Thực hiện kiểm tra bản cập nhật
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('[AutoUpdater] Lỗi khi gọi checkForUpdatesAndNotify:', err);
  });
}

module.exports = { initializeAutoUpdater };
