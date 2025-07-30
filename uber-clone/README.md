# Uber Clone - Full Stack Application

A complete Uber clone application built with modern web technologies including React.js, Node.js/Express, and MySQL.

## 🚀 Features

### Core Features
- **User Authentication & Authorization** - JWT-based auth with role management
- **Real-time Communication** - Socket.IO for live updates
- **Ride Booking System** - Complete ride lifecycle management
- **Driver Management** - Driver registration and availability tracking
- **Payment Processing** - Mock payment system with promo codes
- **Rating System** - User and driver ratings
- **Responsive Design** - Bootstrap-based modern UI

### User Roles
- **Riders** - Book rides, track drivers, make payments
- **Drivers** - Accept rides, update availability, track earnings
- **Both** - Users can be both riders and drivers

## 🏗️ Tech Stack

### Frontend
- **React.js 18** - Modern UI library
- **React Router DOM** - Client-side routing
- **React Bootstrap** - UI components and styling
- **Axios** - HTTP client
- **Socket.IO Client** - Real-time communication

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.IO** - Real-time communication
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **MySQL2** - Database driver

### Database
- **MySQL** - Primary database
- Comprehensive schema with 8+ tables
- Optimized indexes for performance

## 📁 Project Structure

```
uber-clone/
├── frontend/                 # React.js application
│   ├── public/
│   ├── src/
│   │   ├── components/       # Reusable components
│   │   ├── contexts/         # React contexts (Auth, Socket)
│   │   ├── pages/           # Page components
│   │   ├── App.js           # Main app component
│   │   └── index.js         # Entry point
│   └── package.json
├── backend/                  # Node.js/Express API
│   ├── config/              # Database configuration
│   ├── middleware/          # Custom middleware
│   ├── routes/              # API routes
│   ├── server.js            # Express server
│   └── package.json
├── database/                # Database schema
│   └── schema.sql          # MySQL database schema
└── README.md
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

### 1. Clone the Repository
```bash
git clone <repository-url>
cd uber-clone
```

### 2. Database Setup
```bash
# Login to MySQL
mysql -u root -p

# Create database and tables
source database/schema.sql
```

### 3. Backend Setup
```bash
cd backend
npm install

# Configure environment variables
cp .env.example .env
# Edit .env file with your database credentials

# Start the backend server
npm run dev
```

### 4. Frontend Setup
```bash
cd ../frontend
npm install

# Start the React development server
npm start
```

### 5. Access the Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 🔧 Environment Variables

Create a `.env` file in the backend directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=uber_clone

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d

# CORS Configuration
CLIENT_URL=http://localhost:3000
```

## 📱 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### Rides
- `POST /api/rides/request` - Request a ride
- `POST /api/rides/:id/accept` - Accept ride (driver)
- `POST /api/rides/:id/start` - Start ride (driver)
- `POST /api/rides/:id/complete` - Complete ride (driver)
- `POST /api/rides/:id/cancel` - Cancel ride
- `GET /api/rides/my-rides` - Get user rides
- `POST /api/rides/:id/rate` - Rate ride

### Drivers
- `POST /api/drivers/register` - Register as driver
- `PUT /api/drivers/availability` - Update availability
- `PUT /api/drivers/location` - Update location
- `GET /api/drivers/nearby` - Get nearby drivers
- `GET /api/drivers/profile` - Get driver profile
- `GET /api/drivers/stats` - Get driver statistics

### Payments
- `POST /api/payments/process` - Process payment
- `GET /api/payments/history` - Payment history
- `GET /api/payments/promo-codes/available` - Available promos
- `POST /api/payments/promo-codes/validate` - Validate promo

### Users
- `GET /api/users/notifications` - Get notifications
- `PUT /api/users/notifications/:id/read` - Mark as read
- `GET /api/users/stats` - User statistics
- `GET /api/users/summary` - User dashboard summary

## 🎯 Key Features Implemented

### 1. User Management
- Secure registration and login
- Profile management
- Password change functionality
- Role-based access control

### 2. Ride Management
- Real-time ride requests
- Driver matching algorithm
- Live ride tracking
- Status updates via Socket.IO

### 3. Driver Features
- Driver registration with vehicle details
- Availability toggle
- Location updates
- Earnings tracking

### 4. Payment System
- Mock payment processing
- Promo code system
- Payment history
- Fare calculation

### 5. Real-time Features
- Live notifications
- Driver location updates
- Ride status changes
- Socket.IO integration

## 🚀 Getting Started

1. **Sign Up** as a new user (rider by default)
2. **Become a Driver** by registering vehicle details
3. **Request Rides** from the dashboard
4. **Accept Rides** as a driver
5. **Track Progress** in real-time
6. **Complete Payments** and rate experiences

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Input validation and sanitization
- CORS protection
- SQL injection prevention
- Role-based authorization

## 📊 Database Schema

The application uses 8 main tables:
- `users` - User accounts and profiles
- `drivers` - Driver-specific information
- `rides` - Ride requests and details
- `payments` - Payment transactions
- `ratings` - User and driver ratings
- `notifications` - System notifications
- `promo_codes` - Promotional offers
- `user_promo_usage` - Promo usage tracking

## 🎨 UI/UX Features

- Responsive design for all devices
- Modern Bootstrap-based interface
- Intuitive navigation
- Real-time status updates
- Interactive dashboards
- Professional styling

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## 🚀 Deployment

### Backend (Node.js)
- Deploy to Heroku, AWS, or DigitalOcean
- Set up environment variables
- Configure database connection

### Frontend (React)
- Build production version: `npm run build`
- Deploy to Netlify, Vercel, or AWS S3
- Configure API endpoints

### Database
- Use managed MySQL service (AWS RDS, Google Cloud SQL)
- Import schema and sample data
- Configure security groups

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Support

For support and questions:
- Email: support@uberclone.com
- Create an issue in the repository
- Check the documentation

## 🔄 Updates

This is a comprehensive Uber clone with:
- ✅ Complete authentication system
- ✅ Real-time ride booking
- ✅ Driver management
- ✅ Payment processing
- ✅ Modern responsive UI
- ✅ Full API coverage
- ✅ Socket.IO integration
- ✅ Database optimization

Ready for production deployment with proper environment configuration!