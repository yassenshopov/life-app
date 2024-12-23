interface SectionHeaderProps {
  title: string;
  className?: string;
}

export const SectionHeader = ({
  title,
  className = '',
}: SectionHeaderProps) => {
  return (
    <h2
      className={`text-3xl font-bold mb-8 text-center bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 text-transparent bg-clip-text ${className}`}
    >
      {title}
    </h2>
  );
};
