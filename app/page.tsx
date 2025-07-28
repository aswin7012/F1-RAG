"use client";
import Image from "next/image";
import f1gptLogo from "./assets/logo.jpeg";
import { useChat } from "@ai-sdk/react";
import { Message } from "ai";
import PromptSuggestionRow from "./components/PromptSuggestionRow";
import LoadingBubble from "./components/LoadingBubble";
import Bubble from "./components/Bubble";


const Home = () => {
  const { append, status, messages, input, handleInputChange, handleSubmit } = useChat();

  const noMessages = !messages || messages.length === 0;
  const isLoading = status === 'streaming' || status === 'submitted';

  const handlePromptClicked = (text: string) => {
    const msg: Message = {
      id: crypto.randomUUID(),
      content: text,
      role: "user"
    }
    append(msg);
  }

  return (
    <main>
      <Image src={f1gptLogo} width={250} alt="F1 GPT Logo" />
      <section className={noMessages ? "" : "populated"}>
        {noMessages ? (
          <>
            <p className="starter-text">
              The Ultimate place for Forrmula One super fans!. Ask F1GPT anything about
              the fantastic topic of F1 racing and it will come back with the most up-to-date
              answers. We hope you enyoy!
            </p>
            <br />
            <PromptSuggestionRow onPromptClick={handlePromptClicked} />
          </>
        ) : (
          <>
            {messages.map((message, index) => <Bubble key={`message-${index}`} message={message}/>)}
            {isLoading && <LoadingBubble /> }
          </>
        )}
      </section>
      <form onSubmit={handleSubmit}>
        <input className="question-box" onChange={handleInputChange} value={input} placeholder="Ask me something..."/>
        <input type="submit" />
      </form>
    </main>
  )
}

export default Home;