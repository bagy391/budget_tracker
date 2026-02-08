# Budget Tracker PWA

A modern, mobile-friendly Progressive Web App for tracking family budgets, expenses, and income with dynamic charts and smooth animations.

## Features

- 🎨 **Beautiful Dark Theme** with vibrant gradients and glassmorphism effects
- 📱 **PWA Support** - Install on your device for app-like experience
- 👥 **Family Management** - Create families and share budgets
- 💰 **Budget Tracking** - Set monthly budgets with safe-to-spend calculations
- 📊 **Dynamic Charts** - Spending trends, category breakdowns, and income tracking
- 📝 **Transaction Management** - Add, edit, and delete expenses and incomes
- 🎯 **Category & Payment Methods** - Fully customizable with emoji support
- 📱 **Mobile Responsive** - Optimized for all screen sizes

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

Edit `.env.local` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Important**: Make sure your Supabase database has the required schema and functions as provided in your database setup.

### 3. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 4. Build for Production

```bash
npm run build
```

### 5. Preview Production Build

```bash
npm run preview
```

## PWA Installation

When running in production or via HTTPS:

1. Open the app in a browser
2. Look for the "Install" prompt or menu option
3. Click install to add to your home screen

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool
- **Supabase** - Backend and authentication
- **Recharts** - Data visualization
- **React Router** - Navigation
- **date-fns** - Date utilities

## Project Structure

```
src/
├── components/
│   ├── common/          # Reusable UI components
│   ├── forms/           # Form components
│   ├── Layout.jsx       # Main layout with navbar
│   ├── Navbar.jsx       # Navigation component
│   └── ProtectedRoute.jsx
├── contexts/
│   ├── AuthContext.jsx  # Authentication state
│   └── BudgetContext.jsx # Budget & family state
├── pages/
│   ├── Login.jsx
│   ├── Signup.jsx
│   ├── FamilyOnboarding.jsx
│   ├── Overview.jsx
│   ├── Transactions.jsx
│   ├── Dashboard.jsx
│   ├── Budget.jsx
│   └── Settings.jsx
├── utils/
│   ├── supabaseClient.js
│   └── calculations.js
├── App.jsx
├── main.jsx
└── index.css           # Design system & global styles
```

## Features Guide

### Overview Page
- Quick stats for current month
- Add expense/income buttons
- Recent transactions list

### Transactions Page
- Filter by month/year
- View all expenses and incomes
- Edit/delete transactions

### Dashboard Page
- Spending trends line chart
- Category breakdown pie chart
- Budget utilization history
- Income tracking chart
- Date period filters

### Budget Page
- Set/update monthly budget
- Visual progress bar with current date marker
- Safe-to-spend calculation per day
- Budget health indicators

### Settings Page
- Switch between families
- Create new families
- Manage categories (add/edit/delete)
- Manage payment methods
- Sign out

## License

MIT
