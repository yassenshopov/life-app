import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

const features = [
  {
    title: 'Sleep Analysis',
    description:
      'Track your sleep patterns, duration, and quality with detailed analytics',
  },
  {
    title: 'Fitness Monitoring',
    description:
      'Monitor your workouts, steps, and heart rate with comprehensive charts',
  },
  {
    title: 'Health Metrics',
    description:
      'Keep track of vital health metrics and see your progress over time',
  },
];

export function Features() {
  return (
    <section className="py-16 px-4 sm:px-8 bg-white/50 dark:bg-slate-900/50">
      <div className="max-w-7xl mx-auto">
        <h2
          className={`text-3xl font-bold text-center mb-12 text-slate-900 dark:text-white ${outfit.className}`}
        >
          Key Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-lg bg-white/80 dark:bg-slate-800/80 shadow-sm"
            >
              <h3 className="text-xl font-semibold mb-4">{feature.title}</h3>
              <p className="text-slate-600 dark:text-slate-300">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
