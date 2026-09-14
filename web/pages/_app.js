import Head from "next/head";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        {/* 모바일에서 데스크톱 레이아웃(약 980px)으로 렌더링된 뒤 축소되는 걸 막아서
            styles/globals.css의 반응형 미디어쿼리가 실제로 적용되게 한다. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
