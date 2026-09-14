import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="ko">
      <Head>
        {/* viewport 태그는 여기(_document.js)에 넣지 않는다 — next/head가 만드는 기본
            <meta name="viewport" content="width=device-width"> 와 중복 렌더링되어 두 개의
            viewport 태그가 나오고(Next.js가 빌드 시 이를 경고: no-document-viewport-meta),
            initial-scale/viewport-fit이 먹지 않는다. 실제 값은 _app.js에서 next/head로 지정. */}
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0b0d12" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/favicon.png" type="image/png" sizes="64x64" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link
          rel="stylesheet"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
        <meta name="description" content="지금 보고 있는 뉴스 기사의 진위·편향을 근거와 함께 알려주는 데스크톱 AI 에이전트" />
        {/* 카카오톡/문자/트위터 등으로 링크 공유 시 미리보기 카드용 — "링크 복사해서 PC로
            보내기" 버튼이 실제로 쓰이는 경로라 이게 없으면 맨 URL 텍스트만 뜬다.
            og:url은 배포 도메인이 확정되면 절대경로로 채워 넣을 것. */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="뉴스 판별 에이전트" />
        <meta property="og:title" content="뉴스를 읽다가 궁금하면, 캐릭터 클릭 한 번으로 끝" />
        <meta
          property="og:description"
          content="지금 보고 있는 뉴스 기사의 진위 신뢰도·편향 방향·반대편 기사·댓글 여론을 근거와 함께 보여주는 Windows 데스크톱 AI 에이전트"
        />
        <meta property="og:image" content="/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="뉴스를 읽다가 궁금하면, 캐릭터 클릭 한 번으로 끝" />
        <meta
          name="twitter:description"
          content="지금 보고 있는 뉴스 기사의 진위 신뢰도·편향 방향·반대편 기사·댓글 여론을 근거와 함께 보여주는 Windows 데스크톱 AI 에이전트"
        />
        <meta name="twitter:image" content="/og-image.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
