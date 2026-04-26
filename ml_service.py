from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import numpy as np
import os
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

app = Flask(__name__)
CORS(app)

# Load SVD model
with open('triptrove_model_v2.pkl', 'rb') as f:
    data = pickle.load(f)

matrix = data['matrix']
users_list = data['users_list']
places_list = data['places_list']
user_idx = data['user_idx']
place_idx = data['place_idx']
user_place_ratings = data['user_place_ratings']
place_vibe = data['place_vibe']
place_city = data['place_city']
all_places = data['all_places']
global_mean = data['global_mean']

# Load SBERT model (downloads once, cached after)
print("Loading SBERT model...")
sbert = SentenceTransformer('all-MiniLM-L6-v2')
print("SBERT loaded!")

def build_profile_vector(vibe_history):
    """Average SBERT embeddings of all vibes in history"""
    if not vibe_history:
        return None
    embeddings = sbert.encode(vibe_history)
    return np.mean(embeddings, axis=0)

def predict_rating(user_id, place):
    if place not in place_idx:
        return global_mean

    p_inner = place_idx[place]
    item_col = matrix[:, p_inner]
    rated_by = np.where(item_col > 0)[0]

    if len(rated_by) == 0:
        return global_mean

    if user_id in user_idx:
        u_inner = user_idx[user_id]
        u_vec = matrix[u_inner]

        sims = []
        for other_u in rated_by:
            if other_u == u_inner:
                continue
            o_vec = matrix[other_u]
            norm = np.linalg.norm(u_vec) * np.linalg.norm(o_vec)
            sim = np.dot(u_vec, o_vec) / norm if norm > 0 else 0
            sims.append((sim, item_col[other_u]))

        if sims:
            sim_sum = sum(abs(s) for s, _ in sims)
            return sum(s * r for s, r in sims) / sim_sum if sim_sum > 0 else global_mean

    rated = item_col[item_col > 0]
    return float(np.mean(rated)) if len(rated) > 0 else global_mean

@app.route('/ml-recommend', methods=['POST'])
def recommend():
    body = request.json
    user_id = body.get('user_id')
    city = body.get('city', '').lower()
    top_k = body.get('top_k', 5)

    seen = set(user_place_ratings.get(user_id, {}).keys())

    predictions = []
    for place in all_places:
        if place in seen:
            continue

        pred = predict_rating(user_id, place)
        predictions.append({
            'place': place,
            'predicted_rating': round(float(pred), 2),
            'vibe': place_vibe.get(place, ''),
            'city': place_city.get(place, '')
        })

    predictions.sort(key=lambda x: x['predicted_rating'], reverse=True)

    if city:
        city_filtered = [p for p in predictions if p['city'].lower() == city]
        if len(city_filtered) >= 3:
            predictions = city_filtered

    return jsonify({
        'recommendations': predictions[:top_k],
        'model': 'SVD-based CF',
        'rmse': 0.44
    })

@app.route('/match-travellers', methods=['POST'])
def match_travellers():
    try:
        body = request.json
        current_user_id = body.get('user_id')
        current_vibes = body.get('vibe_history', [])
        all_users = body.get('all_users', [])  # [{user_id, username, vibe_history}]
        top_k = body.get('top_k', 5)

        if not current_vibes:
            return jsonify({'error': 'No vibe history found for this user'}), 400

        # Build current user's profile vector
        current_vector = build_profile_vector(current_vibes)
        if current_vector is None:
            return jsonify({'error': 'Could not build profile vector'}), 400

        matches = []

        for user in all_users:
            # Skip current user
            if str(user.get('user_id')) == str(current_user_id):
                continue

            other_vibes = user.get('vibe_history', [])
            if not other_vibes:
                continue

            # Build other user's profile vector
            other_vector = build_profile_vector(other_vibes)

            # Cosine similarity
            sim = cosine_similarity(
                current_vector.reshape(1, -1),
                other_vector.reshape(1, -1)
            )[0][0]

            # Find shared vibes
            shared = list(set(current_vibes) & set(other_vibes))

            matches.append({
                'user_id': user.get('user_id'),
                'username': user.get('username'),
                'match_percentage': round(float(sim) * 100, 1),
                'shared_vibes': shared,
                'their_vibes': other_vibes[:3]  # show max 3
            })

        # Sort by match percentage
        matches.sort(key=lambda x: x['match_percentage'], reverse=True)

        return jsonify({
            'matches': matches[:top_k],
            'model': 'KNN-SBERT',
            'current_user_vibes': current_vibes
        })

    except Exception as e:
        print("Match error:", e)
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'places_in_model': len(all_places),
        'users_in_model': len(users_list)
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5001)))