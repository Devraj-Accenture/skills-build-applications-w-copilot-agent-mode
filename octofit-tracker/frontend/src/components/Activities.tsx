import { CapabilityCard } from './CapabilityCard.js';
import { useEffect, useState } from 'react';
import { getJson } from '../api/client.js';

type Activity = {
  _id?: string;
  type: string;
  minutes: number;
  points: number;
};

type ActivityResponse = { activities: Activity[] };

export default function Activities() {
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getJson<ActivityResponse>('/api/activities')
      .then(({ activities: result }) => {
        if (active) setActivities(result);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Unknown error');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="card h-100">
      <div className="card-body">
        <h2 className="h4">Activities</h2>
        <p>Track student activity minutes and points.</p>

        {error ? (
          <p role="alert">Unable to load activities: {error}</p>
        ) : activities === null ? (
          <p role="status">Loading activities...</p>
        ) : activities.length === 0 ? (
          <p>No activities yet.</p>
        ) : (
          <ul>
            {activities.map((activity, index) => (
              <li key={activity._id ?? `${activity.type}-${activity.minutes}-${index}`}>
                {activity.type} - {activity.minutes} minutes, {activity.points} points
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}