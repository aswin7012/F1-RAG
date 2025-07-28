import "./global.css";
import { ReactNode } from "react";

export const metadata = {
  title: "F1GPT",
  decription: "This is all formula one questions"
}

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
      </head>
      <body>{children}</body>
    </html>
  )
}

export default RootLayout