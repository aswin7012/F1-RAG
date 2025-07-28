import { MouseEventHandler } from "react";

const PromptSuggestionButton = ({ text, onClick }: { onClick: MouseEventHandler, text: string}) => {
  return (
    <button className="prompt-suggestion-button" onClick={onClick}>
      {text}
    </button>
  )
}

export default PromptSuggestionButton;