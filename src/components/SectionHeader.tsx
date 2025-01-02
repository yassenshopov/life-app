import { Outfit } from 'next/font/google';

interface SectionHeaderProps {
  title: string;
  className?: string;
}
const outfit = Outfit({ subsets: ['latin'] });

export const SectionHeader = ({
  title,
}: SectionHeaderProps) => {
  return (
    <h2
      className={`text-3xl md:text-4xl font-bold mt-20 md:mt-16 mb-6 md:mb-8 text-center bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 text-transparent bg-clip-text tracking-tight ${outfit.className}`}
    >
      {title}
    </h2>
  );
};
