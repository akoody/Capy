import { useState, useEffect } from 'react';
import api from '../services/api';
import { User } from '../types';

const FriendsView = () => {
  const [friends, setFriends] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchFriendsData = async () => {
    try {
      const friendsRes = await api.get('/users/me/friends');
      setFriends(friendsRes.data);

      const requestsRes = await api.get('/friends');
      setFriendRequests(requestsRes.data);
    } catch (error) {
      console.error('Failed to fetch friends data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriendsData();
  }, []);

  const handleSearch = async () => {
    try {
      const response = await api.get(`/users?search=${searchTerm}`);
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to search users', error);
    }
  };

  const handleAddFriend = async (recipientId: string) => {
    try {
      await api.post('/friends', { recipientId });
      // TODO: refresh data
    } catch (error) {
      console.error('Failed to add friend', error);
    }
  };

  const handleAcceptRequest = async (id: string) => {
    try {
      await api.post(`/friends/${id}/accept`);
      fetchFriendsData();
    } catch (error) {
      console.error('Failed to accept friend request', error);
    }
  };

  const handleRejectRequest = async (id: string) => {
    try {
      await api.post(`/friends/${id}/reject`);
      fetchFriendsData();
    } catch (error) {
      console.error('Failed to reject friend request', error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-4">Friends</h1>

      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">Search for Friends</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mt-1 block w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-color)] sm:text-sm transition-all"
          />
          <button onClick={handleSearch} className="bg-[color:var(--primary-color)] text-white px-4 py-2 rounded-lg">Search</button>
        </div>
        <div className="mt-4">
          {users.map(user => (
            <div key={user._id} className="bg-[color:var(--card-bg-color)] border border-[color:var(--card-border-color)] p-4 rounded-2xl mb-4 flex justify-between items-center">
              <p>{user.firstName}</p>
              <button onClick={() => handleAddFriend(user._id)} className="bg-green-500 text-white px-4 py-2 rounded-lg">Add Friend</button>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">Friend Requests</h2>
        {friendRequests.filter(req => req.status === 'pending').map(req => (
          <div key={req._id} className="bg-[color:var(--card-bg-color)] border border-[color:var(--card-border-color)] p-4 rounded-2xl mb-4 flex justify-between items-center">
            <p>{req.requester.firstName}</p>
            <div>
              <button onClick={() => handleAcceptRequest(req._id)} className="bg-green-500 text-white px-4 py-2 rounded-lg mr-2">Accept</button>
              <button onClick={() => handleRejectRequest(req._id)} className="bg-red-500 text-white px-4 py-2 rounded-lg">Reject</button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-xl font-bold text-white mb-4">My Friends</h2>
        {friends.map(friend => (
          <div key={friend._id} className="bg-[color:var(--card-bg-color)] border border-[color:var(--card-border-color)] p-4 rounded-2xl mb-4">
            <p>{friend.firstName}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FriendsView;
