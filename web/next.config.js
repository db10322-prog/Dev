const path = require("path");

/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // web/ 은 모노레포의 하위 폴더이고 api/analyze.js 가 상위의 core/ 를 require 하므로,
  // Vercel의 파일 트레이싱이 리포 루트까지 올라가 core/ 전체를 포함하도록 지정.
  experimental: {
    outputFileTracingRoot: path.join(__dirname, ".."),
  },
};
