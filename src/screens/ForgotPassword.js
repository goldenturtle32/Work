import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import auth from '@react-native-firebase/auth';

export default function ForgotPassword({ navigation }) {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');

    const handlePasswordReset = () => {
        auth()
            .sendPasswordResetEmail(email)
            .then(() => setMessage('Password reset email sent!'))
            .catch(error => setMessage(error.message));
    };

    return (
        <View>
            <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
            />
            <Button title="Reset Password" onPress={handlePasswordReset} />
            {message ? <Text>{message}</Text> : null}
            <Button title="Back to Login" onPress={() => navigation.navigate('Login')} />
        </View>
    );
}
