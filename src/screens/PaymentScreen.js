import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

export default function PaymentScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Payment Information</Text>
      <Button 
        title="Pay Now" 
        onPress={() => Alert.alert('Payment Success', 'Your payment has been successfully processed!')}
      />
      <Button 
        title="Go Back" 
        onPress={() => navigation.goBack()} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  header: {
    fontSize: 24,
    marginBottom: 20,
  },
});
