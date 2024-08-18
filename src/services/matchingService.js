//This service will interact with the database to fetch profiles and apply the matching algorithm.
import { matchUsers } from '../matching/matchAlgorithm';
import firestore from '@react-native-firebase/firestore';

export async function findMatchesForWorker(workerId) {
  const workerProfile = await firestore().collection('users').doc(workerId).get();
  const contractorProfiles = await firestore().collection('users').where('role', '==', 'contractor').get();

  const matches = contractorProfiles.docs.map(doc => {
    const contractorProfile = doc.data();
    const matchScore = matchUsers(workerProfile.data(), contractorProfile);
    return { contractorId: doc.id, matchScore };
  });

  matches.sort((a, b) => b.matchScore - a.matchScore); // Sort by best match

  return matches;
}
