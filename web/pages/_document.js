import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="ko">
      <Head>
        <link
          rel="stylesheet"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
        <meta name="description" content="지금 보고 있는 뉴스 기사의 진위·편향을 근거와 함께 알려주는 데스크톱 AI 에이전트" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
