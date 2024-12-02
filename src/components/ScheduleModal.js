const ScheduleModal = ({ visible, onClose, onSubmit, schedule, setSchedule }) => {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  const toggleDay = (day) => {
    setSchedule(prev => ({
      ...prev,
      [day]: prev[day] ? null : { start: '09:00', end: '17:00' }
    }));
  };

  const updateTime = (day, type, time) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [type]: time
      }
    }));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Set Weekly Schedule</Text>
          
          {days.map(day => (
            <View key={day} style={styles.dayContainer}>
              <TouchableOpacity onPress={() => toggleDay(day)}>
                <Text style={styles.dayText}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
              </TouchableOpacity>
              
              {schedule[day] && (
                <View style={styles.timeContainer}>
                  <TextInput
                    value={schedule[day].start}
                    onChangeText={(time) => updateTime(day, 'start', time)}
                    placeholder="Start Time"
                    style={styles.timeInput}
                  />
                  <TextInput
                    value={schedule[day].end}
                    onChangeText={(time) => updateTime(day, 'end', time)}
                    placeholder="End Time"
                    style={styles.timeInput}
                  />
                </View>
              )}
            </View>
          ))}
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSubmit} style={styles.confirmButton}>
              <Text style={styles.buttonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}; 