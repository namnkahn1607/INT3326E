# React + TypeScript + Vite

Mẫu này cung cấp cấu hình tối thiểu để chạy React trên Vite với HMR và một số quy tắc ESLint.

Hiện có hai plugin chính thức:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) dùng [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) dùng [SWC](https://swc.rs/)

## React Compiler

Mẫu này chưa bật React Compiler vì nó ảnh hưởng đến hiệu năng khi phát triển và build. Để thêm, xem [tài liệu này](https://react.dev/learn/react-compiler/installation).

## Mở rộng cấu hình ESLint

Nếu đang phát triển ứng dụng dùng cho production, bạn nên cập nhật cấu hình để bật các quy tắc lint có kiểm tra kiểu:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

Bạn cũng có thể cài [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) và [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) để có các quy tắc lint riêng cho React:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
