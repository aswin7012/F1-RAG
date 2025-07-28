const Bubble = ({ message }: any) => {
  const { content, role } = message;

  return (
    <div className={`${role} bubble`}>{content}</div>
  )
}

export default Bubble;