/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        academic: {
          cream: '#2d2d2d',      // Obsidian 卡片背景
          beige: '#252525',     // Obsidian 稍亮背景
          lightBeige: '#1e1e1e', // Obsidian 主背景
          purple: '#64c864',     // Obsidian 綠色
          darkBrown: '#e8e8e8',  // Obsidian 主要文字
          sage: '#b8b8b8',       // Obsidian 次要文字
        },
        obsidian: {
          bg: '#1e1e1e',         // 主背景
          card: '#2d2d2d',       // 卡片背景
          hover: '#252525',      // Hover 背景
          text: '#e8e8e8',       // 主要文字
          textSecondary: '#b8b8b8', // 次要文字
          textMuted: '#888888',  // 弱化文字
          accent: '#64c864',     // 強調色（綠色）
          border: 'rgba(100, 200, 100, 0.2)', // 邊框
        },
      },
      fontFamily: {
        serif: ['"Lora"', '"Merriweather"', '"Georgia"', 'serif'],
      },
    },
  },
  plugins: [],
}
