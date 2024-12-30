# Health & Fitness Dashboard

A comprehensive health tracking dashboard built with Next.js that helps users monitor their sleep patterns, physical activity, heart rate, weight, and workout routines. The application syncs with Notion to visualize your health data and provides detailed analytics for better health insights.

## Features

- **Sleep Analysis**

  - Sleep pattern visualization
  - Sleep composition tracking
  - Daily sleep statistics
  - Sleep quality metrics

- **Health Metrics Tracking**

  - Resting heart rate monitoring
  - Step count tracking
  - Weight progression
  - Historical data analysis

- **Workout Management**

  - Muscle group analysis
  - Exercise tracking
  - Workout calendar
  - Training progress visualization

- **Data Visualization**
  - Interactive charts
  - Customizable date ranges
  - Detailed analytics
  - Real-time updates

## Tech Stack

<p align="left">
  <a href="https://nextjs.org" target="_blank" rel="noreferrer" style="margin-right: 2px;">
    <img src="https://cdn.worldvectorlogo.com/logos/nextjs-2.svg" alt="nextjs" width="40" height="40"/>
  </a>&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://www.typescriptlang.org/" target="_blank" rel="noreferrer" style="margin-right: 2px;">
    <img src="https://raw.githubusercontent.com/devicons/devicon/master/icons/typescript/typescript-original.svg" alt="typescript" width="40" height="40"/>
  </a>&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://supabase.com/" target="_blank" rel="noreferrer" style="margin-right: 2px;">
    <img src="https://raw.githubusercontent.com/devicons/devicon/master/icons/supabase/supabase-original.svg" alt="supabase" width="40" height="40"/>
  </a>&nbsp;&nbsp;&nbsp;&nbsp;
    <a href="https://notion.so" target="_blank" rel="noreferrer" style="margin-right: 2px;">
    <img src="https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png" alt="notion" width="40" height="40"/>
  </a>&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://tailwindcss.com/" target="_blank" rel="noreferrer" style="margin-right: 2px;">
    <img src="https://www.vectorlogo.zone/logos/tailwindcss/tailwindcss-icon.svg" alt="tailwind" width="40" height="40"/>
  </a>&nbsp;&nbsp;&nbsp;&nbsp;
    <a href="https://vercel.com/" target="_blank" rel="noreferrer">
    <img src="https://assets.vercel.com/image/upload/v1588805858/repositories/vercel/logo.png" alt="vercel" width="40" height="40"/>
  </a>
</p>

- [Next.js 14](https://nextjs.org) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Supabase](https://supabase.com) - Authentication & Database
- [Notion API](https://developers.notion.com) - Data storage & sync
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Lucide Icons](https://lucide.dev) - UI Icons
- [Vercel Analytics](https://vercel.com/analytics) - Analytics
- [Google Fonts](https://fonts.google.com) - Inter & Outfit fonts

## Getting Started

### Prerequisites

- Node.js 18.17 or higher
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/health-dashboard.git
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Set up environment variables:

```bash
cp .env.example .env.local
```

Add your Supabase and Notion credentials to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_notion_database_id
```

4. Start the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Project Structure

```
├── app/
│   ├── components/
│   │   ├── charts/        # Chart components
│   │   ├── layout/        # Layout components
│   │   └── forms/         # Form components
│   ├── hooks/             # Custom hooks
│   ├── types/             # TypeScript types
│   ├── constants/         # Constants and configurations
│   └── page.tsx           # Main dashboard page
├── public/                # Static assets
└── styles/               # Global styles
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

---

Built with ❤️ using [Next.js](https://nextjs.org/) and deployed on [Vercel](https://vercel.com).
