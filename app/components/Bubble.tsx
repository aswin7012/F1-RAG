type Message = {
  content: string;
  role: string;
};

interface BubbleProps {
  message: Message;
}

const Bubble = ({ message }: BubbleProps) => {
  const { content, role } = message;

  return (
    <div className={`${role} bubble`}>{content}</div>
  )
}

export default Bubble;