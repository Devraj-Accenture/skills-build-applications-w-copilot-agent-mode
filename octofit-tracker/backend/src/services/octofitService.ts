import { Activity, Team, User, Workout } from '../models/index.js';
import { Types } from 'mongoose';
export async function listActivities() {
  return Activity.find().lean();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function createActivity(input: unknown) {
  if (!isRecord(input)) {
    throw Object.assign(new Error('Activity body must be an object'), { status: 400 });
  }

  const { userId, teamId, type, minutes } = input;

  if (typeof userId !== 'string' || !Types.ObjectId.isValid(userId)) {
    throw Object.assign(new Error('A valid userId is required'), { status: 400 });
  }
  if (typeof teamId !== 'string' || !Types.ObjectId.isValid(teamId)) {
    throw Object.assign(new Error('A valid teamId is required'), { status: 400 });
  }
  if (typeof type !== 'string' || !type.trim()) {
    throw Object.assign(new Error('A non-empty activity type is required'), { status: 400 });
  }
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
    throw Object.assign(new Error('Minutes must be a positive number'), { status: 400 });
  }

  const [user, team] = await Promise.all([
    User.exists({ _id: userId }),
    Team.exists({ _id: teamId }),
  ]);

  if (!user || !team) {
    throw Object.assign(new Error('The specified user or team was not found'), { status: 404 });
  }

  return Activity.create({
    user: userId,
    team: teamId,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  if (!isRecord(input)) {
    throw Object.assign(new Error('Team body must be an object'), { status: 400 });
  }

  const { name, mascot } = input;
  if (typeof name !== 'string' || !name.trim()) {
    throw Object.assign(new Error('A team name is required'), { status: 400 });
  }
  if (typeof mascot !== 'string' || !mascot.trim()) {
    throw Object.assign(new Error('A team mascot is required'), { status: 400 });
  }

  const rawMembers = input.members === undefined ? [] : input.members;
  if (!Array.isArray(rawMembers) || !rawMembers.every(
    (id): id is string => typeof id === 'string' && Types.ObjectId.isValid(id),
  )) {
    throw Object.assign(new Error('Members must be valid user IDs'), { status: 400 });
  }

  const memberIds = [...new Set(rawMembers.map((id) => id.toLowerCase()))];
  const existingMembers = await User.find({ _id: { $in: memberIds } }).select('_id').lean();
  if (existingMembers.length !== memberIds.length) {
    throw Object.assign(new Error('One or more members were not found'), { status: 400 });
  }

  return Team.create({
    name: name.trim(),
    mascot: mascot.trim(),
    members: memberIds,
  });
}

export async function getLeaderboard() {
  const teams = await Team.aggregate<{ teamName: string; totalPoints: number }>([
    {
      $lookup: {
        from: Activity.collection.name,
        localField: '_id',
        foreignField: 'team',
        as: 'activities',
      },
    },
    {
      $project: {
        _id: 0,
        teamName: '$name',
        totalPoints: { $sum: '$activities.points' },
      },
    },
    { $sort: { totalPoints: -1, teamName: 1 } },
  ]);

  return teams.map((team, index) => ({ ...team, rank: index + 1 }));
}

function normalizeFocus(value: string) {
  return value.trim().toLowerCase();
}

function focusFromActivity(type: string) {
  switch (normalizeFocus(type)) {
    case 'run':
    case 'running':
    case 'cycle':
    case 'cycling':
    case 'walk':
    case 'walking':
      return 'endurance';
    default:
      return normalizeFocus(type);
  }
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail }).lean();
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const [activities, workouts] = await Promise.all([
    Activity.find({ user: user._id })
      .sort({ occurredAt: -1 })
      .limit(5)
      .select('type')
      .lean(),
    Workout.find().lean(),
  ]);

  const candidates: Array<{ focus: string; reason: string }> = [];
  if (typeof user.fitnessGoal === 'string' && user.fitnessGoal.trim()) {
    candidates.push({
      focus: normalizeFocus(user.fitnessGoal),
      reason: `Recommended because it matches your ${user.fitnessGoal} fitness goal.`,
    });
  }
  for (const activity of activities) {
    candidates.push({
      focus: focusFromActivity(activity.type),
      reason: `Recommended based on your recent ${activity.type} activity.`,
    });
  }

  const preferred = candidates.find(({ focus }) =>
    workouts.some((workout) => normalizeFocus(workout.focus) === focus),
  );
  if (!preferred) return [];

  return workouts
    .filter((workout) => normalizeFocus(workout.focus) === preferred.focus)
    .map((workout) => ({ ...workout, reason: preferred.reason }));
}

export { User };
