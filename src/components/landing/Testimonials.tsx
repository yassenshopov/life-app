import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

const testimonials = [
  {
    quote: "This app has completely transformed how I track my health. The sleep insights are incredible!",
    author: "Sarah J.",
    role: "Fitness Enthusiast"
  },
  {
    quote: "The most comprehensive health tracking app I've used. The interface is intuitive and beautiful.",
    author: "Michael R.",
    role: "Personal Trainer"
  },
  {
    quote: "Finally, all my health data in one place. This is exactly what I've been looking for.",
    author: "Emma L.",
    role: "Healthcare Professional"
  }
];

type TestimonialCardProps = {
  quote: string;
  author: string;
  role: string;
};

function TestimonialCard({ quote, author, role }: TestimonialCardProps) {
  return (
    <div className="p-6 rounded-lg bg-white/80 dark:bg-slate-800/80 shadow-sm">
      <p className="text-slate-600 dark:text-slate-300 mb-4 italic">"{quote}"</p>
      <div>
        <p className="font-semibold">{author}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{role}</p>
      </div>
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="py-16 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto">
        <h2 className={`text-3xl font-bold text-center mb-12 text-slate-900 dark:text-white ${outfit.className}`}>
          What Our Users Say
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard 
              key={index}
              quote={testimonial.quote}
              author={testimonial.author}
              role={testimonial.role}
            />
          ))}
        </div>
      </div>
    </section>
  );
} 