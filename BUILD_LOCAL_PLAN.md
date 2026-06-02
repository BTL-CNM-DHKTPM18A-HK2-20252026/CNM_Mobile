# 📦 Kế Hoạch Build Local - Fruvia Mobile (Expo SDK 54)

> **Dự án**: CNM_Mobile — Fruvia Chat App  
> **Vị trí**: `G:\Workspace\Study\HK2_2025-2026\CNM\Project\CNM_Mobile`  
> **Ngày kiểm tra**: 03/06/2026

---

## ✅ Tóm Tắt Kiểm Tra Hệ Thống

| Thành phần           | Trạng thái                                    | Chi tiết                                   |
| -------------------- | --------------------------------------------- | ------------------------------------------ |
| **Node.js**          | ✅ v22.18.0                                   | Phù hợp                                    |
| **npm**              | ✅ 11.3.0                                     | Phù hợp                                    |
| **Java**             | ⚠️ JDK 21 đang dùng                           | **Nên chuyển sang JDK 17** cho RN 0.81     |
| **Android SDK**      | ✅ `C:\Users\ADMIN\AppData\Local\Android\Sdk` | Build-tools 36.0.0, Platform android-36    |
| **Android NDK**      | ✅ 25.1.8937393 / 27.1.12297006               | Đủ dùng                                    |
| **ANDROID_HOME**     | ✅ Đã set                                     | `C:\Users\ADMIN\AppData\Local\Android\Sdk` |
| **JAVA_HOME**        | ⚠️ Đang trỏ JDK 21                            | `C:\Users\ADMIN\.jdks\corretto-21.0.5`     |
| **local.properties** | ❌ **Chưa có**                                | Cần tạo trong `android/`                   |
| **node_modules**     | ✅ Đã cài                                     | `npm install` đã chạy                      |
| **Global CLI**       | ✅ `eas-cli@20.0.0`, `@expo/cli@54.0.9`       | Sẵn sàng                                   |
| **Dung lượng ổ G:**  | ✅ ~42 GB trống                               | Đủ để build                                |

---

## 📋 Các Bước Build Local

### Bước 1: Tạo file `local.properties`

Thiếu file này → Gradle không biết đường dẫn Android SDK.

```bash
cd android
echo "sdk.dir=C\:\\Users\\ADMIN\\AppData\\Local\\Android\\Sdk" > local.properties
```

> 📄 Nội dung file:
>
> ```properties
> sdk.dir=C\:\\Users\\ADMIN\\AppData\\Local\\Android\\Sdk
> ```

---

### Bước 2: Chuyển sang JDK 17 (khuyến nghị)

React Native 0.81 hoạt động ổn định nhất với **JDK 17**.  
Máy đã có `corretto-17.0.13` tại `C:\Users\ADMIN\.jdks\corretto-17.0.13`.

**Cách 1 — Chỉ đổi cho terminal hiện tại (nhanh):**

```powershell
$env:JAVA_HOME = "C:\Users\ADMIN\.jdks\corretto-17.0.13"
```

**Cách 2 — Đổi vĩnh viễn (chạy PowerShell Administrator):**

```powershell
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Users\ADMIN\.jdks\corretto-17.0.13", "User")
```

**Kiểm tra lại:**

```powershell
java -version   # Phải ra "17.0.13"
```

> ⚠️ _Nếu không đổi, build vẫn có thể chạy với JDK 21 nhưng có nguy cơ lỗi không tương thích._

---

### Bước 3: (Tùy chọn) Re-install dependencies

Nếu `node_modules` đã cũ hoặc có lỗi, hãy cài lại:

```powershell
cd G:\Workspace\Study\HK2_2025-2026\CNM\Project\CNM_Mobile
npm install
```

---

### Bước 4: Build APK Debug (nhanh nhất)

File APK không cần ký, dùng để test ngay trên điện thoại:

```powershell
cd android
.\gradlew assembleDebug
```

⏱ Thời gian: **3-8 phút** (tùy máy, lần đầu có thể lâu hơn do tải dependencies).

📦 Output: `android/app/build/outputs/apk/debug/app-debug.apk`

---

### Bước 5: Build APK Release (dùng cho phát hành)

```powershell
cd android
.\gradlew assembleRelease
```

📦 Output: `android/app/build/outputs/apk/release/app-release.apk`

> ⚠️ Bản Release hiện tại dùng **debug.keystore** để ký.  
> Khi phát hành thật, cần tạo keystore riêng và cập nhật `signingConfigs` trong `android/app/build.gradle`.

---

### Bước 6: Nếu build lỗi — Clean & Build lại

```powershell
cd android
.\gradlew clean
.\gradlew assembleDebug
```

---

## 🐳 Phương Án Dự Phòng: Build Bằng EAS Cloud

Nếu build local gặp lỗi môi trường, dùng EAS Cloud:

```powershell
eas build --platform android --profile preview
```

- ✅ Không cần JDK, Android SDK
- ✅ Build trên server Expo
- ❌ Cần internet, có giới hạn lượt free

---

## 🗺️ So Sánh Các Phương Án

| Tiêu chí          | Build Local (Gradle)     | EAS Cloud                  |
| ----------------- | ------------------------ | -------------------------- |
| **Tốc độ**        | 🟢 Nhanh (3-8 phút)      | 🟡 Trung bình (10-20 phút) |
| **Internet**      | Chỉ cần lúc đầu          | Cần全程                    |
| **Phí**           | Miễn phí                 | Miễn phí có giới hạn       |
| **APK output**    | Trực tiếp file           | Link tải + QR code         |
| **Debug signing** | Tự động (debug.keystore) | Tự động                    |
| **Phụ thuộc**     | JDK 17 + Android SDK     | Không cần                  |

---

## ⚠️ Lưu Ý Quan Trọng

1. **local.properties là bắt buộc** — Local build sẽ fail nếu thiếu file này.
2. **JDK 17** ổn định nhất với RN 0.81 — JDK 21 có thể gây lỗi `Unsupported class file major version`.
3. **Lần build đầu tiên** có thể lâu (Gradle sẽ download dependencies). Các lần sau nhanh hơn nhờ cache.
4. **Android Emulator** không bắt buộc — bạn có thể copy file `.apk` sang điện thoại thật để test.
5. **File APK Debug** nằm ở `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 📱 Cài Đặt APK Lên Điện Thoại

1. Copy file `app-debug.apk` vào máy điện thoại.
2. Mở file → Cho phép cài đặt từ nguồn không xác định.
3. Cài đặt và mở app.

---

_Kế hoạch được tạo bởi AI Agent — Fruvia Mobile_
