# 📱 Hướng Dẫn Build APK cho Dự Án Fruvia Mobile (Expo SDK 54)

Dự án **CNM_Mobile** đã được kiểm tra cấu trúc. Dưới đây là kết quả đánh giá cấu trúc Expo hiện tại và hướng dẫn chi tiết các bước để build file APK (cả local và qua cloud).

---

## 🔍 1. Đánh Giá Cấu Trúc Expo của Project
Dự án của bạn **đã chuẩn cấu trúc Expo Router (phiên bản mới, SDK 54)**. Cụ thể:
- **`app/`**: Thư mục chứa các màn hình và cấu trúc định tuyến (file-based routing) sử dụng **Expo Router**.
- **`app.json`**: File cấu hình Expo chứa đầy đủ thông tin app (`name`, `slug`, `scheme`, `package` name `com.nguyenminhcn.fruviamobile`, permissions, plugins).
- **`package.json`**: Cấu hình dependencies phù hợp với Expo SDK 54, React Native 0.81.
- **`android/`**: Thư mục mã nguồn native Android đã được sinh ra (thông qua lệnh `npx expo prebuild`). Điều này rất tốt vì bạn có thể build trực tiếp trên máy của mình (Local Build) mà không bắt buộc phải dùng server Expo Cloud.

---

## 🛠️ 2. Cách Build APK

Có 2 phương pháp chính để build ra file APK:
- **Cách 1: Build Local (Dùng Gradle trên máy của bạn)** - Khuyên dùng vì dự án đã có sẵn thư mục `android/`. Không cần tài khoản Expo paid và build rất nhanh nếu máy cấu hình tốt.
- **Cách 2: Build Cloud (Dùng EAS Build của Expo)** - Phù hợp nếu máy bạn chưa cài đặt Android SDK / Java JDK.

---

### CÁCH 1: BUILD APK TRÊN MÁY LOCAL (Dùng Gradle)

Do bạn đã có thư mục `/android`, bạn có thể build trực tiếp bằng máy cá nhân của mình.

#### 📋 Yêu cầu hệ thống (Prerequisites)
1. **Java JDK 17** (Bắt buộc cho Expo SDK 54 / React Native 0.81). Kiểm tra bằng lệnh:
   ```bash
   java -version
   ```
2. **Android SDK** (Thường đi kèm Android Studio).
3. Đã cấu hình các biến môi trường:
   - `JAVA_HOME` trỏ tới JDK 17.
   - `ANDROID_HOME` trỏ tới thư mục Android SDK (ví dụ: `C:\Users\<Username>\AppData\Local\Android\Sdk`).

---

#### 🚀 Các bước thực hiện:

#### Bước 1: Cài đặt thư viện và chuẩn bị dự án
Mở terminal tại thư mục root của dự án (`CNM_Mobile`) và chạy:
```bash
npm install
```

#### Bước 2: Tạo bundle javascript mới nhất (Tùy chọn nhưng khuyến nghị)
Để đảm bảo code JS mới nhất được đóng gói vào app:
```bash
npx expo export
```

#### Bước 3: Di chuyển vào thư mục android và build APK
**Trên Windows (PowerShell / Command Prompt):**
```powershell
cd android
# Build APK bản Debug (để test nhanh, không cần ký chữ ký số)
.\gradlew assembleDebug

# HOẶC Build APK bản Release (bản chạy mượt hơn, tối ưu hơn)
.\gradlew assembleRelease
```

**Trên macOS / Linux:**
```bash
cd android
# Cấp quyền thực thi nếu cần
chmod +x gradlew
# Build APK bản Debug
./gradlew assembleDebug
# HOẶC Build APK bản Release
./gradlew assembleRelease
```

#### 📦 Đường dẫn file APK sau khi build xong:
- **Bản Debug APK:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **Bản Release APK:** `android/app/build/outputs/apk/release/app-release.apk`

*Bạn chỉ cần copy file APK này vào điện thoại Android và cài đặt để test.*

---

### CÁCH 2: BUILD APK TRÊN CLOUD (Dùng EAS Build)

Nếu máy bạn không cấu hình được môi trường Java/Android SDK, hãy dùng Expo Application Services (EAS). Cách này build trên server của Expo và trả về link tải APK.

#### Bước 1: Cài đặt EAS CLI
Cài đặt công cụ dòng lệnh của Expo toàn cục trên máy:
```bash
npm install -g eas-cli
```

#### Bước 2: Đăng nhập vào tài khoản Expo
Nếu chưa có tài khoản, hãy đăng ký tại [expo.dev](https://expo.dev). Sau đó chạy:
```bash
eas login
```

#### Bước 3: Khởi tạo cấu hình EAS Build
Chạy lệnh sau tại thư mục root của dự án:
```bash
eas build:configure
```
*Lệnh này sẽ tạo ra một file tên là `eas.json` ở thư mục gốc.*

#### Bước 4: Cấu hình xuất file APK trong `eas.json`
Mở file `eas.json` vừa được tạo ra và cập nhật cấu hình cho phần `preview` để xuất ra định dạng `.apk` (mặc định Expo sẽ xuất ra `.aab` cho Google Play).
Đảm bảo file `eas.json` có cấu hình tương tự như sau:

```json
{
  "cli": {
    "version": ">= 10.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

#### Bước 5: Thực hiện lệnh build APK trên Cloud
Chạy lệnh dưới đây để bắt đầu build APK:
```bash
eas build --platform android --profile preview
```
- EAS sẽ tự động nén code, tải lên server Expo và thực hiện build.
- Sau khi hoàn thành, terminal sẽ hiển thị một **đường dẫn tải xuống (Download URL)** trực tiếp của file `.apk` hoặc mã QR để bạn quét tải về điện thoại.

---

## ⚠️ Một Số Lỗi Thường Gặp Khi Build Local & Cách Khắc Phục

1. **Lỗi phiên bản Java (Unsupported class file major version / JDK mismatch)**:
   - *Nguyên nhân:* Phiên bản Java trên máy bạn khác với JDK 17 (thường là JDK 8 hoặc JDK 21).
   - *Khắc phục:* Cài đặt **JDK 17**, thiết lập biến môi trường `JAVA_HOME` trỏ tới đường dẫn cài đặt của JDK 17.

2. **Lỗi thiếu Local Properties / SDK Location**:
   - *Nguyên nhân:* Gradle không tìm thấy thư mục Android SDK.
   - *Khắc phục:* Tạo file tên là `local.properties` bên trong thư mục `android/` và thêm dòng sau:
     ```properties
     sdk.dir=C\:\\Users\\<Tên_User_Của_Bạn>\\AppData\\Local\\Android\\Sdk
     ```
     *(Lưu ý sử dụng dấu sẹt kép `\\` đối với đường dẫn Windows).*

3. **Lỗi cache khi build lại**:
   - *Khắc phục:* Chạy lệnh dọn dẹp cache trước khi build:
     ```bash
     cd android
     .\gradlew clean
     ```
