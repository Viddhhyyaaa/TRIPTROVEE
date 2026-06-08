#  TripTrove – Intelligent Travel Planning & Recommendation Platform

TripTrove is an AI-powered travel planning platform that helps users discover destinations, build personalized itineraries, receive intelligent recommendations, and connect with like-minded travelers.

The platform combines AI-generated travel suggestions, collaborative filtering, behavioral analytics, and semantic traveler matching to create a personalized travel planning experience.

##  Features

###  Smart Place Discovery
- Get travel recommendations based on:
  - City
  - Travel vibe
  - Radius preferences
- AI-generated destination suggestions with structured outputs.

###  Day-wise Itinerary Planning
- Create multi-day travel plans.
- Organize destinations by day.
- Modify and refine plans iteratively.

###  Saved Places & Travel Memory
- Save favorite destinations.
- View travel history across sessions.
- Persistent profile-based recommendations.

###  Personalized Recommendations
- Collaborative filtering-based recommendation engine.
- Learns from user interactions and preferences.
- Generates personalized destination rankings.

###  Traveler Matching
- Find travelers with similar travel styles.
- Uses SBERT embeddings and cosine similarity.
- Displays compatibility scores based on vibe history.

###  Behavioral Analytics
Tracks meaningful actions such as:
- Saved places
- Map opens
- Itinerary selections

These interactions are used to improve future recommendations.

###  Budget Estimation
- Provides approximate travel budget estimates.
- Helps users evaluate trip feasibility before planning.

###  Navigation Support
- Google Maps integration.
- Uber deep-link integration for transportation assistance.

##  System Architecture

TripTrove follows a two-service architecture:

### Main Application Service
- Node.js
- Express.js
- MongoDB

Responsibilities:
- Authentication
- User management
- Itinerary planning
- Profile management
- Recommendation orchestration
- Interaction tracking

### Machine Learning Service
- Python Flask

Responsibilities:
- Personalized recommendation inference
- Traveler matching
- Embedding-based similarity computation

##  Tech Stack

### Frontend
- HTML5
- CSS3
- JavaScript
- Tailwind CSS

### Backend
- Node.js
- Express.js

### Database
- MongoDB
- Mongoose

### Machine Learning
- Python
- Flask
- Sentence Transformers (SBERT)
- Cosine Similarity

### AI Integration
- Groq API

### Security
- JWT Authentication
- bcryptjs Password Hashing

### Version Control
- Git
- GitHub

##  Workflow

1. User logs in securely.
2. User enters travel preferences.
3. AI generates destination suggestions along with trending places and the user's past prefrences based places recommendations.
4. User saves destinations or adds them to itineraries.
5. User interactions are stored in MongoDB.
6. ML service generates personalized recommendations.
7. Traveler matching identifies compatible travelers.
8. Profile dashboard reflects user activity and travel history.

##  Security Features

- JWT-based authentication
- Password hashing using bcryptjs
- Protected routes for user-specific operations
- User-scoped data access

##  Key Highlights

- AI-assisted travel recommendations
- Personalized ranking system
- Behavior-aware recommendation engine
- Semantic traveler matching
- Day-wise itinerary planning
- Profile-based travel memory
- Modular Node.js + Flask architecture


##  Author

**Vidhya Rai**


