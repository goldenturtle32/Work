import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { firebaseConfig } from '../firebase'; // adjust path as needed

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const deleteNullNameDocuments = async () => {
  const userAttributesRef = collection(db, 'user_attributes');
  
  try {
    const q = query(userAttributesRef, where('name', '==', null));
    const querySnapshot = await getDocs(q);
    
    const deletePromises = querySnapshot.docs.map(doc => 
      deleteDoc(doc.ref)
    );
    
    await Promise.all(deletePromises);
    console.log(`Deleted ${querySnapshot.size} documents with null names`);
    
  } catch (error) {
    console.error('Error deleting documents:', error);
  }
  
  // Exit the script
  process.exit(0);
};

// Run the cleanup
deleteNullNameDocuments(); 