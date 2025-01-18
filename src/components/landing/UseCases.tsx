import Image from 'next/image';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

const useCases = [
  {
    title: 'Financial Planning',
    description: 'Track investments, monitor stock prices in real-time, and analyze your financial data with beautiful charts.',
    features: [
      'Real-time stock price updates',
      'Investment portfolio tracking',
      'Expense categorization',
      'Financial goal tracking'
    ],
    imageSrc: {
      light: '/financial-dashboard.png',
      dark: '/financial-dashboard-dark.png'
    },
    imageAlt: 'Financial dashboard preview'
  },
  {
    title: 'Fitness & Health',
    description: 'Sync your workout data, track progress, and visualize your fitness journey with detailed analytics.',
    features: [
      'Strava integration',
      'Sleep tracking analysis',
      'Workout planning',
      'Progress visualization'
    ],
    imageSrc: {
      light: '/fitness-dashboard.png',
      dark: '/fitness-dashboard-dark.png'
    },
    imageAlt: 'Fitness dashboard preview'
  },
  {
    title: 'Task Management',
    description: 'Enhanced to-do lists with drag-and-drop interface and smart task organization.',
    features: [
      'Drag-and-drop interface',
      'Priority-based sorting',
      'Quick mobile input',
      'Progress tracking'
    ],
    imageSrc: {
      light: '/tasks-dashboard.png',
      dark: '/tasks-dashboard-dark.png'
    },
    imageAlt: 'Task management dashboard preview'
  }
];

export function UseCases({ outfit }: { outfit: any }) {
  return (
    <div className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className={`${outfit.className} text-base font-semibold leading-7 text-indigo-600`}>Use Cases</h2>
          <p className={`${outfit.className} mt-2 text-3xl font-bold tracking-tight sm:text-4xl`}>
            Built for every workflow
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            Choose the modules that match your needs and customize them to your workflow.
          </p>
        </div>
        
        <div className="mt-16 space-y-20 lg:mt-20 lg:space-y-20">
          {useCases.map((useCase, index) => (
            <div key={useCase.title} className={`flex flex-col gap-y-12 lg:gap-y-0 lg:flex-row lg:items-center ${
              index % 2 === 1 ? 'lg:flex-row-reverse' : ''
            } lg:gap-x-8`}>
              <div className="lg:w-1/2">
                <div className="aspect-[16/9] overflow-hidden rounded-xl bg-gray-900/5 dark:bg-gray-100/5">
                  <Image 
                    src={useCase.imageSrc.light}
                    alt={useCase.imageAlt} 
                    width={1920}
                    height={1080}
                    className="w-full h-full object-cover object-center dark:hidden" 
                  />
                  <Image 
                    src={useCase.imageSrc.dark}
                    alt={useCase.imageAlt} 
                    width={1920}
                    height={1080}
                    className="hidden w-full h-full object-cover object-center dark:block" 
                  />
                </div>
              </div>
              <div className="lg:w-1/2">
                <h3 className={`${outfit.className} text-2xl font-bold tracking-tight`}>{useCase.title}</h3>
                <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
                  {useCase.description}
                </p>
                <ul className="mt-8 space-y-3">
                  {useCase.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-x-3">
                      <CheckCircleIcon className="h-5 w-5 flex-none text-indigo-600" />
                      <span className="text-gray-600 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 