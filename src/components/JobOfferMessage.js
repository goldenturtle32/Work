const JobOfferMessage = ({ jobOffer, onRespond }) => {
  if (jobOffer.status !== 'pending') {
    return (
      <View style={styles.systemMessage}>
        <Text>Job offer {jobOffer.status}</Text>
      </View>
    );
  }

  return (
    <View style={styles.jobOfferContainer}>
      <Text style={styles.jobOfferTitle}>New Job Offer</Text>
      {Object.entries(jobOffer.schedule)
        .filter(([_, schedule]) => schedule !== null)
        .map(([day, schedule]) => (
          <Text key={day}>
            {day}: {schedule.start} - {schedule.end}
          </Text>
        ))}
      <View style={styles.jobOfferButtons}>
        <TouchableOpacity 
          onPress={() => onRespond(jobOffer.id, true)}
          style={styles.acceptButton}
        >
          <Text style={styles.buttonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => onRespond(jobOffer.id, false)}
          style={styles.declineButton}
        >
          <Text style={styles.buttonText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}; 