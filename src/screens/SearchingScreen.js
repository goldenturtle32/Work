import React, { useRef } from 'react';
import { Animated, View } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Card, Button } from 'react-native-paper';

const SwipeableCard = ({ children }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    new PanGestureHandler({
      onGestureEvent: (event) => {
        translateX.setValue(event.nativeEvent.translationX);
      },
      onHandlerStateChange: (event) => {
        if (event.nativeEvent.state === State.END) {
          // Handle swipe actions based on translateX value
          if (translateX.getValue() > 200) {
            // Swipe right action
          } else if (translateX.getValue() < -200) {
            // Swipe left action
          } else {
            // Snap back to original position
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: false,
            }).start();
          }
        }
      },
    })
  ).current;

  return (
    <PanGestureHandler {...panResponder.handlers}>
      <Animated.View style={{ transform: [{ translateX }] }}>
        {children}
      </Animated.View>
    </PanGestureHandler>
  );
};

const JobCard = ({ job }) => {
  return (
    <SwipeableCard>
      <Card style={styles.card}>
        <Card.Title title={job.company} subtitle={job.category} />
        <Card.Content>
          <Text>{job.jobType}</Text>
          <Text>${job.rate}</Text>
          <Text>{job.skills.join(', ')}</Text>
        </Card.Content>
      </Card>
    </SwipeableCard>
  );
};

const SearchingScreen = () => {
  const [jobs, setJobs] = useState([
    // ... Your job data
  ]);

  return (
    <View style={styles.container}>
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
      <View style={styles.bottomNavigation}>
        <Button onPress={() => navigation.navigate('SearchingScreen')}>Searching</Button>
        <Button onPress={() => navigation.navigate('MatchesScreen')}>Matches</Button>
        <Button onPress={() => navigation.navigate('ProfileScreen')}>Profile</Button>
        <Button onPress={() => navigation.navigate('SettingsScreen')}>Settings</Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
  },
  card: {
    marginBottom: 10,
  },
  bottomNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    padding: 10,
  },
});

export default SearchingScreen;