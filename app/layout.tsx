import "./global.css";

export const metadata = {
    title :"F1GPT",
    description: "F1GPT is a chatbot that provides information about Formula 1"
}

const RootLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <html lang="en">
            <body>
                {children}
            </body>
        </html>
    );
}

export default RootLayout;