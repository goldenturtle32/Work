import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Image,
  PanResponder,
  Platform,
  ActivityIndicator,
  TextInput,
  ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons'; 
import { LinearGradient } from 'expo-linear-gradient';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;



const exampleMessage = {
  text: 'Hi there! I saw your profile and I think you would be a great fit for our team.',
  timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
  sender: 'them'
};

const exampleSuggestions = [
  'Tell me more about your experience',
  'What salary range are you looking for?',
  'Are you available for an interview?'
];

const exampleMatches = [
  {
    id: '1',
    accepted: 1,
    lastMessage: "Hi there! When can you start?",
    otherUser: {
      companyName: "ABC Industries",
      jobTitle: "Warehouse Assistant",
      cityName: "Chicago, IL"
    }
  },
  {
    id: '2',
    accepted: 0,
    lastMessage: null,
    otherUser: {
      companyName: "Quick Retail",
      jobTitle: "Sales Associate",
      cityName: "Chicago, IL"
    }
  },
  {
    id: '3',
    accepted: 0,
    lastMessage: "Thanks for your application!",
    otherUser: {
      companyName: "City Coffee Shop",
      jobTitle: "Barista",
      cityName: "Evanston, IL"
    }
  }
];

const tutorialSteps = [
  {
    id: 1,
    title: 'Welcome to Opus!',
    description: 'Let us show you how to find your perfect job match.',
    type: 'intro',
    position: { top: SCREEN_HEIGHT * 0.3, left: SCREEN_WIDTH * 0.1 },
  },
  {
    id: 2,
    title: 'Browse Profiles',
    description: 'You\'ll see profiles like this that match your preferences.',
    type: 'card',
    position: { top: 80, centered: true },
    cardPosition: { top: SCREEN_HEIGHT * 0.3, left: SCREEN_WIDTH / 2 - 150 },
  },
  {
    id: 3,
    title: 'Swipe Right',
    description: 'Swipe right on profiles you\'re interested in.',
    type: 'swipe-right',
    position: { top: SCREEN_HEIGHT * 0.15, right: SCREEN_WIDTH * 0.1 },
    arrowPosition: { top: SCREEN_HEIGHT * 0.45, right: SCREEN_WIDTH * 0.2 },
  },
  {
    id: 4,
    title: 'Swipe Left',
    description: 'Swipe left to pass on profiles that don\'t interest you.',
    type: 'swipe-left',
    position: { top: SCREEN_HEIGHT * 0.15, left: SCREEN_WIDTH * 0.1 },
    arrowPosition: { top: SCREEN_HEIGHT * 0.45, left: SCREEN_WIDTH * 0.2 },
  },
  {
    id: 5,
    title: 'View Details',
    description: 'Tap on a card to see more information about the profile.',
    type: 'tap-card',
    position: { top: SCREEN_HEIGHT * 0.15, left: SCREEN_WIDTH * 0.1 },
    highlightPosition: { top: SCREEN_HEIGHT * 0.4, left: SCREEN_WIDTH / 2 },
  },
  {
    id: 6,
    title: 'It\'s a Match!',
    description: 'When both parties are interested, you\'ll get a match notification.',
    type: 'match',
    position: { top: SCREEN_HEIGHT * 0.6, left: SCREEN_WIDTH * 0.1 },
  },
  {
    id: 7,
    title: 'Matches Screen',
    description: 'Access all your matches from the Matches tab.',
    type: 'matches-screen',
    position: { top: SCREEN_HEIGHT * 0.15, left: SCREEN_WIDTH * 0.1 },
    highlightPosition: { bottom: 25, left: SCREEN_WIDTH * 0.5 },
  },
  {
    id: 8,
    title: 'Chat with Matches',
    description: 'Message your matches to discuss opportunities.',
    type: 'chat',
    position: { top: SCREEN_HEIGHT * 0.15, left: SCREEN_WIDTH * 0.1 },
  },
];

// Update the example data with our retail job
const exampleJobData = {
  jobTitle: 'Retail Associate',
  companyName: 'Joe\'s Sporting Goods',
  job_overview: 'Looking for someone interested in working at Joe\'s Sporting Goods twice a week. Job mainly includes working the register, stocking shelves, and helping customers. Previously retail work preferred but not required!',
  salaryRange: {
    min: 18,
    max: 19
  },
  weeklyHours: 12,
  location: {
    distance: '3 miles away',
    travelTimes: {
      walking: '20 min',
      transit: '12 min',
      driving: '6 min'
    }
  },
  skills: ['Customer Service', 'Stocking Shelves', 'Working Register'],
  availability: {
    Wednesday: { slots: [{ startTime: '11:00 AM', endTime: '5:00 PM' }] },
    Saturday: { slots: [{ startTime: '8:00 AM', endTime: '2:00 PM' }] }
  },
  matchAnalysis: {
    pros: [
      'Flexible schedule',
      'Good hourly rate',
      'Close to your location'
    ],
    cons: [
      'Limited hours available',
      'Weekend work required'
    ]
  }
};

const TutorialOverlay = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [isCardVisible, setIsCardVisible] = useState(true);
  const [activeMatchTab, setActiveMatchTab] = useState('details'); // 'details' or 'chat'
  
  // Separate animated values for different types of animations
  const cardPosition = useRef(new Animated.ValueXY()).current;
  const hintAnimation = useRef(new Animated.Value(0)).current;
  
  // Reset card position when step changes
  useEffect(() => {
    console.log(`Step changed to: ${currentStep}`);
    
    // Reset position and make card visible again
    cardPosition.setValue({ x: 0, y: 0 });
    setIsCardVisible(true);
    setExpanded(false);
    
    // Start hint animation if we're on swipe steps
    if (currentStep === 3 || currentStep === 4) {
      startHintAnimation();
    }
  }, [currentStep]);
  
  const startHintAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(hintAnimation, {
          toValue: currentStep === 3 ? 40 : -40, // Right or left based on step
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.timing(hintAnimation, {
          toValue: 0,
          duration: 800,
          useNativeDriver: false,
        }),
      ]),
      { iterations: 2 }
    ).start();
  };
  
  const handleSwipeRight = () => {
    console.log("Swiping right animation starting");
    
    // Animate card off screen
    Animated.timing(cardPosition, {
      toValue: { x: SCREEN_WIDTH + 100, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      console.log("Right swipe animation complete, CURRENT STEP:", currentStep);
      
      // Advance to next step after swiping right on step 3
      if (currentStep === 3) {
        setTimeout(() => {
          console.log("ADVANCING to step 4");
          setCurrentStep(4);
        }, 500);
      }
    });
  };
  
  const handleSwipeLeft = () => {
    console.log("Swiping left animation starting");
    
    // Animate card off screen
    Animated.timing(cardPosition, {
      toValue: { x: -SCREEN_WIDTH - 100, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      console.log("Left swipe animation complete, CURRENT STEP:", currentStep);
      
      // Advance to next step after swiping left on step 4
      if (currentStep === 4) {
        setTimeout(() => {
          console.log("ADVANCING to step 5");
          setCurrentStep(5);
        }, 500);
      }
    });
  };
  
  // Update the PanResponder setup to ensure it works properly
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        console.log("Pan responder granted");
      },
      onPanResponderMove: (_, gesture) => {
        console.log("Moving card: ", gesture.dx);
        cardPosition.setValue({ x: gesture.dx, y: 0 });
      },
      onPanResponderRelease: (_, gesture) => {
        console.log("Pan responder released", gesture.dx);
        if (gesture.dx > 120) {
          handleSwipeRight();
        } else if (gesture.dx < -120) {
          handleSwipeLeft();
        } else {
          // Return to center if not swiped far enough
          Animated.spring(cardPosition, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            friction: 5,
          }).start();
        }
      }
    })
  ).current;

  // Manual navigation buttons for tutorial steps
  const goToNextStep = () => {
    setCurrentStep(prev => prev + 1);
  };
  
  const handleSkip = () => {
    if (onComplete) onComplete();
  };

  const renderCurrentStep = () => {
    // Check if current step is valid
    if (currentStep > tutorialSteps.length) {
      // If we're beyond the last step, complete the tutorial
      if (onComplete) onComplete();
      // Return empty to prevent rendering errors
      return null;
    }
    
    const step = tutorialSteps.find(s => s.id === currentStep);
    console.log("RENDERING STEP:", currentStep, step?.type);
    
    // Safety check: if step is undefined, don't try to render anything
    if (!step) {
      console.log("Step not found:", currentStep);
      return null;
    }
    
    // Special handling for match step
    if (step?.type === 'match') {
      console.log("RENDERING MATCH SCREEN");
      return (
        <View style={styles.stepContainer}>
          {/* Instruction banner for match step */}
          <View style={styles.instructionOuterContainer}>
            <View style={styles.instructionContainer}>
              <Text style={styles.instructionTitle}>
                {step.title}
              </Text>
              <Text style={styles.instructionText}>
                {step.description}
              </Text>
            </View>
          </View>
          
          {/* Match modal content */}
          <View style={[matchModalStyles.modalOverlay, { position: 'absolute', top: 120, bottom: 100, left: 0, right: 0 }]}>
            <View style={[matchModalStyles.modalContainer, { height: '75%' }]}>
              <TouchableOpacity style={matchModalStyles.closeButton} onPress={() => setCurrentStep(currentStep + 1)}>
                <Text style={matchModalStyles.closeButtonText}>×</Text>
              </TouchableOpacity>
              
              <Text style={matchModalStyles.matchTitle}>It's a Match!</Text>
              
              <View style={matchModalStyles.tabContainer}>
                <TouchableOpacity 
                  style={[
                    matchModalStyles.tab, 
                    activeMatchTab === 'details' && matchModalStyles.activeTab
                  ]}
                  onPress={() => setActiveMatchTab('details')}
                >
                  <Text style={[
                    matchModalStyles.tabText, 
                    activeMatchTab === 'details' && matchModalStyles.activeTabText
                  ]}>
                    Details
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    matchModalStyles.tab,
                    activeMatchTab === 'chat' && matchModalStyles.activeTab
                  ]}
                  onPress={() => setActiveMatchTab('chat')}
                >
                  <Text style={[
                    matchModalStyles.tabText,
                    activeMatchTab === 'chat' && matchModalStyles.activeTabText
                  ]}>
                    Chat
                  </Text>
                </TouchableOpacity>
              </View>
              
              <View style={matchModalStyles.contentContainer}>
                {activeMatchTab === 'details' ? (
                  /* Job Details Content */
                  <ScrollView style={matchModalStyles.detailsContent}>
                    <View style={matchModalStyles.detailsSection}>
                      <Text style={matchModalStyles.jobTitle}>Retail Associate</Text>
                      <Text style={matchModalStyles.companyName}>Joe's Sporting Goods</Text>
                    </View>
                    
                    <View style={matchModalStyles.detailsSection}>
                      <Text style={matchModalStyles.sectionTitle}>Job Description</Text>
                      <Text style={matchModalStyles.sectionText}>
                        Looking for a friendly, reliable retail associate to help with customer service, inventory management, and sales. Previous retail experience preferred but not required.
                      </Text>
                    </View>
                    
                    <View style={matchModalStyles.detailsSection}>
                      <Text style={matchModalStyles.sectionTitle}>Pay Range</Text>
                      <Text style={matchModalStyles.sectionText}>$18-$19/hr</Text>
                    </View>
                    
                    <View style={matchModalStyles.detailsSection}>
                      <Text style={matchModalStyles.sectionTitle}>Location</Text>
                      <Text style={matchModalStyles.sectionText}>3 miles away (15 min drive)</Text>
                    </View>
                    
                    <View style={matchModalStyles.detailsSection}>
                      <Text style={matchModalStyles.sectionTitle}>Schedule</Text>
                      <Text style={matchModalStyles.sectionText}>Part-time, 15-20 hours/week</Text>
                      <Text style={matchModalStyles.scheduleItem}>Wednesday: 11:00 AM - 5:00 PM</Text>
                      <Text style={matchModalStyles.scheduleItem}>Saturday: 8:00 AM - 2:00 PM</Text>
                    </View>
                    
                    <View style={matchModalStyles.buttonContainer}>
                      <TouchableOpacity 
                        style={matchModalStyles.messageButton}
                        onPress={() => setActiveMatchTab('chat')}
                      >
                        <Text style={matchModalStyles.messageButtonText}>Message Employer</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                ) : (
                  /* Chat Content */
                  <View style={chatStyles.container}>
                    <ScrollView style={chatStyles.messagesContainer}>
                      {/* Company welcome message */}
                      <View style={chatStyles.messageRow}>
                        <View style={chatStyles.avatarContainer}>
                          <View style={chatStyles.companyAvatar}>
                            <Text style={chatStyles.avatarText}>JS</Text>
                          </View>
                        </View>
                        <View style={chatStyles.messageBubble}>
                          <Text style={chatStyles.messageText}>
                            Thanks for your interest in the Retail Associate position! We're excited to connect with you.
                          </Text>
                          <Text style={chatStyles.timestamp}>
                            10:30 AM
                          </Text>
                        </View>
                      </View>
                      
                      {/* Day divider */}
                      <View style={chatStyles.dayDivider}>
                        <Text style={chatStyles.dayDividerText}>Today</Text>
                      </View>
                      
                      {/* Company question */}
                      <View style={chatStyles.messageRow}>
                        <View style={chatStyles.avatarContainer}>
                          <View style={chatStyles.companyAvatar}>
                            <Text style={chatStyles.avatarText}>JS</Text>
                          </View>
                        </View>
                        <View style={chatStyles.messageBubble}>
                          <Text style={chatStyles.messageText}>
                            When would you be available to start?
                          </Text>
                          <Text style={chatStyles.timestamp}>
                            11:15 AM
                          </Text>
                        </View>
                      </View>
                    </ScrollView>
                    
                    {/* Suggested replies */}
                    <View style={chatStyles.suggestionsContainer}>
                      <Text style={chatStyles.suggestionsTitle}>Suggested Replies</Text>
                      <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false} 
                        style={chatStyles.suggestionsScroll}
                      >
                        <TouchableOpacity style={chatStyles.suggestionBubble}>
                          <Text style={chatStyles.suggestionText}>I can start next week</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={chatStyles.suggestionBubble}>
                          <Text style={chatStyles.suggestionText}>Do you offer training?</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={chatStyles.suggestionBubble}>
                          <Text style={chatStyles.suggestionText}>What's the dress code?</Text>
                        </TouchableOpacity>
                      </ScrollView>
                    </View>
                    
                    {/* Message input */}
                    <View style={chatStyles.inputContainer}>
                      <TextInput
                        placeholder="Type a message..."
                        style={chatStyles.input}
                        placeholderTextColor="#999"
                      />
                      <TouchableOpacity style={chatStyles.sendButton}>
                        <Ionicons name="send" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>
          
          {/* Next button */}
          <TouchableOpacity 
            style={styles.nextButton}
            onPress={() => {
              console.log("Next button pressed, current step:", currentStep);
              if (currentStep < tutorialSteps.length) {
                console.log("Advancing to step:", currentStep + 1);
                setCurrentStep(currentStep + 1);
              } else {
                console.log("Tutorial complete, calling onComplete");
                onComplete();
              }
            }}
          >
            <Text style={styles.nextButtonText}>
              {currentStep < tutorialSteps.length ? 'Next' : 'Got it!'}
            </Text>
          </TouchableOpacity>

          {/* Step indicators */}
          <View style={styles.stepIndicators}>
            {tutorialSteps.map((s) => (
              <View
                key={s.id}
                style={[
                  styles.stepDot,
                  currentStep === s.id && styles.activeStepDot,
                ]}
              />
            ))}
          </View>

          {/* Skip tutorial button */}
          <TouchableOpacity 
            style={styles.skipButton}
            onPress={() => {
              console.log("Skip button pressed");
              onComplete();
            }}
          >
            <Text style={styles.skipButtonText}>Skip Tutorial</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Rest of the renderCurrentStep function remains the same for other step types
    return (
      <View style={styles.stepContainer}>
        {/* Render step content based on type */}
        {step.type === 'intro' && renderIntroStep(step)}
        {step.type === 'card' && (
          <>
            {renderInstructionStep(step)}
            {renderJobCard()}
          </>
        )}
        {step.type === 'swipe-right' && (
          <>
            {renderInstructionStep(step)}
            {renderSwipeableJobCard('right')}
          </>
        )}
        {step.type === 'swipe-left' && (
          <>
            {renderInstructionStep(step)}
            {renderSwipeableJobCard('left')}
          </>
        )}
        {step.type === 'tap-card' && renderTapCardStep(step)}
        {step.type === 'match' && (
          <>
            {renderMatchNotification(step)}
          </>
        )}
        {step.type === 'chat' && renderChatStep(step)}
        {step.type === 'matches-screen' && (
          <>
            {renderInstructionStep(step)}
            {renderMatchesScreen()}
          </>
        )}
        {step.type === 'suggestions' && renderSuggestionsStep(step)}

        {/* Next button - always visible and prominent */}
        <TouchableOpacity 
          style={styles.nextButton}
          onPress={() => {
            console.log("Next button pressed, current step:", currentStep);
            if (currentStep < tutorialSteps.length) {
              console.log("Advancing to step:", currentStep + 1);
              setCurrentStep(currentStep + 1);
              cardPosition.setValue({ x: 0, y: 0 });
              setExpanded(false);
            } else {
              console.log("Tutorial complete, calling onComplete");
              onComplete();
            }
          }}
        >
          <Text style={styles.nextButtonText}>
            {currentStep < tutorialSteps.length ? 'Next' : 'Got it!'}
          </Text>
        </TouchableOpacity>

        {/* Step indicators */}
        <View style={styles.stepIndicators}>
          {tutorialSteps.map((s) => (
            <View
              key={s.id}
              style={[
                styles.stepDot,
                currentStep === s.id && styles.activeStepDot,
              ]}
            />
          ))}
        </View>

        {/* Skip tutorial button */}
        <TouchableOpacity 
          style={styles.skipButton}
          onPress={() => {
            console.log("Skip button pressed");
            onComplete();
          }}
        >
          <Text style={styles.skipButtonText}>Skip Tutorial</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderJobCard = () => {
    // Calculate estimated weekly pay
    const minWeeklyPay = (exampleJobData.salaryRange.min * exampleJobData.weeklyHours).toFixed(0);
    const maxWeeklyPay = (exampleJobData.salaryRange.max * exampleJobData.weeklyHours).toFixed(0);
    
    return (
      <Animated.View
        style={[
          styles.cardContainer,
          {
            transform: [
              { translateX: cardPosition.x },
              { rotate: cardPosition.x.interpolate({
                inputRange: [-200, 0, 200],
                outputRange: ['-10deg', '0deg', '10deg'],
                extrapolate: 'clamp'
              })}
            ]
          }
        ]}
        {...(currentStep === 3 || currentStep === 4 ? panResponder.panHandlers : {})}
      >
        <TouchableOpacity 
          style={styles.card}
          activeOpacity={0.95}
          onPress={() => currentStep === 5 && setExpanded(true)}
        >
          <LinearGradient
            colors={['#1e3a8a', '#1e40af']}
            style={styles.cardGradient}
          >
            <View style={styles.contentCard}>
              {!expanded ? (
                // Front of card
                <>
                  <View style={styles.titleContainer}>
                    <Text style={styles.jobTitle}>{exampleJobData.jobTitle}</Text>
                    <View style={styles.companyBadge}>
                      <Text style={styles.companyName}>{exampleJobData.companyName}</Text>
                    </View>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Overview</Text>
                    <Text style={styles.overviewText}>
                      {exampleJobData.job_overview}
                    </Text>
                  </View>

                  <View style={styles.gridContainer}>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>Pay Range</Text>
                      <Text style={styles.gridValue}>
                        ${exampleJobData.salaryRange.min} - ${exampleJobData.salaryRange.max}/hr
                      </Text>
                    </View>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>Est. Weekly Hours</Text>
                      <Text style={styles.gridValue}>
                        {exampleJobData.weeklyHours} hours
                      </Text>
                    </View>
                  </View>

                  <View style={styles.weeklyPayContainer}>
                    <Text style={styles.weeklyPayLabel}>Est. Weekly Pay</Text>
                    <Text style={styles.weeklyPayValue}>
                      ${minWeeklyPay} - ${maxWeeklyPay}
                    </Text>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Location & Travel Times</Text>
                    <View style={styles.locationInfoContainer}>
                      <Text style={styles.distanceText}>
                        {exampleJobData.location.distance}
                      </Text>
                      <View style={styles.travelTimesContainer}>
                        <View style={styles.travelTimeItem}>
                          <Ionicons name="car" size={16} color="#64748b" />
                          <Text style={styles.travelTimeText}>{exampleJobData.location.travelTimes.driving}</Text>
                        </View>
                        <View style={styles.travelTimeItem}>
                          <Ionicons name="bus" size={16} color="#64748b" />
                          <Text style={styles.travelTimeText}>{exampleJobData.location.travelTimes.transit}</Text>
                        </View>
                        <View style={styles.travelTimeItem}>
                          <Ionicons name="walk" size={16} color="#64748b" />
                          <Text style={styles.travelTimeText}>{exampleJobData.location.travelTimes.walking}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </>
              ) : (
                // Expanded card (back side)
                <>
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Required Skills</Text>
                    <View style={styles.skillsContainer}>
                      {exampleJobData.skills.map((skill, index) => (
                        <View key={index} style={styles.skillBubble}>
                          <Text style={styles.skillText}>{skill}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Required Availability</Text>
                    <View style={styles.availabilityContainer}>
                      {Object.entries(exampleJobData.availability).map(([day, dayData]) => {
                        return (
                          <View key={day} style={styles.dayContainer}>
                            <View style={[styles.dayChip, styles.dayChipAvailable]}>
                              <Text style={[styles.dayText, styles.dayTextAvailable]}>
                                {day}
                              </Text>
                            </View>
                            <View style={styles.timeSlotsContainer}>
                              {dayData.slots.map((slot, index) => (
                                <Text key={index} style={styles.timeSlot}>
                                  {slot.startTime} - {slot.endTime}
                                </Text>
                              ))}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Job Match Analysis</Text>
                    <View style={styles.analysisContainer}>
                      <Text style={styles.categoryTitle}>Pros</Text>
                      <View style={styles.prosContainer}>
                        {exampleJobData.matchAnalysis.pros.map((pro, index) => (
                          <View key={index} style={[styles.proBubble, {marginBottom: 6}]}>
                            <Ionicons name="checkmark-circle" size={14} color="#166534" />
                            <Text style={styles.proText}>{pro}</Text>
                          </View>
                        ))}
                      </View>
                      
                      <Text style={styles.categoryTitle}>Considerations</Text>
                      <View style={styles.consContainer}>
                        {exampleJobData.matchAnalysis.cons.map((con, index) => (
                          <View key={index} style={[styles.conBubble, {marginBottom: 6}]}>
                            <Ionicons name="alert-circle" size={14} color="#991b1b" />
                            <Text style={styles.conText}>{con}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                </>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Add this somewhere to catch renders
  useEffect(() => {
    console.log("RENDER: Current step =", currentStep);
  }, [currentStep]);

  // Update the renderSwipeableJobCard function to ensure panResponder is properly attached
  const renderSwipeableJobCard = (direction) => {
    console.log(`Rendering swipeable card for ${direction} direction`);
    
    // Calculate estimated weekly pay
    const minWeeklyPay = (exampleJobData.salaryRange.min * exampleJobData.weeklyHours).toFixed(0);
    const maxWeeklyPay = (exampleJobData.salaryRange.max * exampleJobData.weeklyHours).toFixed(0);
    
    // Add a hint text for swiping
    const hintText = direction === 'right' 
      ? 'Try swiping this card to the right →'
      : '← Try swiping this card to the left';
    
    return (
      <>
        <Animated.View
          style={[
            styles.cardContainer,
            {
              transform: [
                { translateX: cardPosition.x },
                { rotate: cardPosition.x.interpolate({
                  inputRange: [-200, 0, 200],
                  outputRange: ['-10deg', '0deg', '10deg'],
                  extrapolate: 'clamp'
                })}
              ]
            }
          ]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity 
            style={styles.card}
            activeOpacity={0.95}
          >
            <LinearGradient
              colors={['#1e3a8a', '#1e40af']}
              style={styles.cardGradient}
            >
              <View style={styles.contentCard}>
                {/* Card content - same as renderJobCard */}
                <View style={styles.titleContainer}>
                  <Text style={styles.jobTitle}>{exampleJobData.jobTitle}</Text>
                  <View style={styles.companyBadge}>
                    <Text style={styles.companyName}>{exampleJobData.companyName}</Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Overview</Text>
                  <Text style={styles.overviewText}>
                    {exampleJobData.job_overview}
                  </Text>
                </View>

                <View style={styles.gridContainer}>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Pay Range</Text>
                    <Text style={styles.gridValue}>
                      ${exampleJobData.salaryRange.min} - ${exampleJobData.salaryRange.max}/hr
                    </Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Est. Weekly Hours</Text>
                    <Text style={styles.gridValue}>
                      {exampleJobData.weeklyHours} hours
                    </Text>
                  </View>
                </View>

                <View style={styles.weeklyPayContainer}>
                  <Text style={styles.weeklyPayLabel}>Est. Weekly Pay</Text>
                  <Text style={styles.weeklyPayValue}>
                    ${minWeeklyPay} - ${maxWeeklyPay}
                  </Text>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Location & Travel Times</Text>
                  <View style={styles.locationInfoContainer}>
                    <Text style={styles.distanceText}>
                      {exampleJobData.location.distance}
                    </Text>
                    <View style={styles.travelTimesContainer}>
                      <View style={styles.travelTimeItem}>
                        <Ionicons name="car" size={16} color="#64748b" />
                        <Text style={styles.travelTimeText}>{exampleJobData.location.travelTimes.driving}</Text>
                      </View>
                      <View style={styles.travelTimeItem}>
                        <Ionicons name="bus" size={16} color="#64748b" />
                        <Text style={styles.travelTimeText}>{exampleJobData.location.travelTimes.transit}</Text>
                      </View>
                      <View style={styles.travelTimeItem}>
                        <Ionicons name="walk" size={16} color="#64748b" />
                        <Text style={styles.travelTimeText}>{exampleJobData.location.travelTimes.walking}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
        
        {/* Swipe hint text */}
        <View style={styles.swipeHintContainer}>
          <Text style={styles.swipeHintText}>{hintText}</Text>
        </View>
      </>
    );
  };

  const renderMatchNotification = (step) => {
    console.log("Rendering match notification");
    
    return (
      <View style={matchStyles.matchOverlay}>
        <View style={matchStyles.matchContainer}>
          <LinearGradient
            colors={['#1e3a8a', '#3949ab']}
            style={matchStyles.matchGradient}
          >
            <View style={matchStyles.matchContent}>
              <Text style={matchStyles.matchTitle}>It's a Match!</Text>
              <Text style={matchStyles.matchSubtitle}>
                You and Joe's Sporting Goods liked each other
              </Text>
              
              <View style={matchStyles.profilesContainer}>
                <View style={matchStyles.profileCircle}>
                  <View style={matchStyles.userProfileImage}>
                    <Text style={matchStyles.userInitials}>YN</Text>
                  </View>
                </View>
                
                <View style={matchStyles.matchIconContainer}>
                  <Ionicons name="checkmark-circle" size={36} color="#4ade80" />
                </View>
                
                <View style={matchStyles.profileCircle}>
                  <View style={matchStyles.companyProfileImage}>
                    <Text style={matchStyles.companyInitials}>JS</Text>
                  </View>
                </View>
              </View>
              
              <View style={matchStyles.matchInfoContainer}>
                <View style={matchStyles.matchDetailItem}>
                  <Ionicons name="briefcase-outline" size={22} color="#93c5fd" />
                  <Text style={matchStyles.matchDetailText}>Retail Associate</Text>
                </View>
                
                <View style={matchStyles.matchDetailItem}>
                  <Ionicons name="cash-outline" size={22} color="#93c5fd" />
                  <Text style={matchStyles.matchDetailText}>$18-$19/hr</Text>
                </View>
                
                <View style={matchStyles.matchDetailItem}>
                  <Ionicons name="location-outline" size={22} color="#93c5fd" />
                  <Text style={matchStyles.matchDetailText}>3 miles away</Text>
                </View>
              </View>
              
              <View style={matchStyles.actionButtonsContainer}>
                <TouchableOpacity 
                  style={matchStyles.primaryButton}
                  onPress={() => goToNextStep()}
                >
                  <Text style={matchStyles.primaryButtonText}>Send Message</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={matchStyles.secondaryButton}
                  onPress={() => goToNextStep()}
                >
                  <Text style={matchStyles.secondaryButtonText}>Keep Browsing</Text>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>
    );
  };

  const renderMatchesScreen = () => {
    return (
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 40, // To account for the banner at the top
      }}>
        <View style={[
          matchesStyles.container, 
          { 
            position: 'relative',  // Override absolute positioning
            top: 0,                // Override top positioning
            left: 0,               // Override left positioning
            width: 330,            // Set a fixed width instead of full screen
            height: 400,           // Set a fixed height
          }
        ]}>
          {/* Header */}
          <View style={matchesStyles.header}>
            <View style={matchesStyles.headerContent}>
              <Text style={matchesStyles.headerTitle}>Your Matches</Text>
              <Text style={matchesStyles.headerSubtitle}>
                Connect with opportunities that match your profile
              </Text>
              <View style={matchesStyles.matchCountContainer}>
                <Ionicons name="chatbubble-ellipses" size={16} color="#93c5fd" />
                <Text style={matchesStyles.matchCount}>
                  {exampleMatches.length} matches found
                </Text>
              </View>
            </View>
          </View>

          {/* Filter tabs */}
          <View style={matchesStyles.stickyHeader}>
            <View style={matchesStyles.filterContainer}>
              <TouchableOpacity
                style={[matchesStyles.filterButton, matchesStyles.activeFilter]}
              >
                <Text style={[matchesStyles.filterText, matchesStyles.activeFilterText]}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[matchesStyles.filterButton]}
              >
                <Text style={[matchesStyles.filterText]}>Messaged</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[matchesStyles.filterButton]}
              >
                <Text style={[matchesStyles.filterText]}>Accepted</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Matches list */}
          <ScrollView 
            style={matchesStyles.scrollContainer}
            contentContainerStyle={matchesStyles.listContent}
          >
            {exampleMatches.map(match => {
              const isAccepted = match.accepted === 1;
              
              return (
                <TouchableOpacity
                  key={match.id}
                  style={[
                    matchesStyles.matchItem,
                    isAccepted && matchesStyles.acceptedMatch
                  ]}
                >
                  <View style={matchesStyles.matchContent}>
                    <View style={matchesStyles.matchHeader}>
                      <View style={matchesStyles.iconTextContainer}>
                        <Ionicons name="business" size={16} color="#6b7280" />
                        <Text style={matchesStyles.name}>
                          {match.otherUser.jobTitle ? `${match.otherUser.jobTitle} - ` : ''}
                          {match.otherUser.companyName || 'Company'}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={matchesStyles.chevronContainer}>
                      <Ionicons 
                        name="chevron-forward" 
                        size={20} 
                        color="#9ca3af"
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    );
  };

  const renderChatStep = (step) => {
    return (
      <>
        {/* Add the instruction banner */}
        <View style={styles.instructionOuterContainer}>
          <View style={styles.instructionContainer}>
            <Text style={styles.instructionTitle}>
              {step.title}
            </Text>
            <Text style={styles.instructionText}>
              {step.description}
            </Text>
          </View>
        </View>
        
        {/* Position the chat container properly */}
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 40, // To account for the banner at the top
        }}>
          <View style={{
            width: 330,
            height: 480,
            backgroundColor: 'white',
            borderRadius: 15,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 5,
          }}>
            <View style={chatStyles.container}>
              <ScrollView style={chatStyles.messagesContainer}>
                {/* Company welcome message */}
                <View style={chatStyles.messageRow}>
                  <View style={chatStyles.avatarContainer}>
                    <View style={chatStyles.companyAvatar}>
                      <Text style={chatStyles.avatarText}>JS</Text>
                    </View>
                  </View>
                  <View style={chatStyles.messageBubble}>
                    <Text style={chatStyles.messageText}>
                      Thanks for your interest in the Retail Associate position! We're excited to connect with you.
                    </Text>
                    <Text style={chatStyles.timestamp}>
                      10:30 AM
                    </Text>
                  </View>
                </View>
                
                {/* Day divider */}
                <View style={chatStyles.dayDivider}>
                  <Text style={chatStyles.dayDividerText}>Today</Text>
                </View>
                
                {/* Company question */}
                <View style={chatStyles.messageRow}>
                  <View style={chatStyles.avatarContainer}>
                    <View style={chatStyles.companyAvatar}>
                      <Text style={chatStyles.avatarText}>JS</Text>
                    </View>
                  </View>
                  <View style={chatStyles.messageBubble}>
                    <Text style={chatStyles.messageText}>
                      When would you be available to start?
                    </Text>
                    <Text style={chatStyles.timestamp}>
                      11:15 AM
                    </Text>
                  </View>
                </View>
              </ScrollView>
              
              {/* Suggested replies */}
              <View style={chatStyles.suggestionsContainer}>
                <Text style={chatStyles.suggestionsTitle}>Suggested Replies</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  style={chatStyles.suggestionsScroll}
                >
                  <TouchableOpacity style={chatStyles.suggestionBubble}>
                    <Text style={chatStyles.suggestionText}>I can start next week</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={chatStyles.suggestionBubble}>
                    <Text style={chatStyles.suggestionText}>Do you offer training?</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={chatStyles.suggestionBubble}>
                    <Text style={chatStyles.suggestionText}>What's the dress code?</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
              
              {/* Message input */}
              <View style={chatStyles.inputContainer}>
                <TextInput
                  placeholder="Type a message..."
                  style={chatStyles.input}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity style={chatStyles.sendButton}>
                  <Ionicons name="send" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </>
    );
  };

  const renderInstructionStep = (step) => {
    return (
      <View style={styles.instructionOuterContainer}>
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionTitle}>
            {step.title}
          </Text>
          <Text style={styles.instructionText}>
            {step.description}
          </Text>
        </View>
      </View>
    );
  };

  const renderIntroStep = (step) => {
    return (
      <View style={styles.introContainer}>
        <View style={styles.introContent}>
          <Text style={styles.introTitle}>{step.title}</Text>
          <Text style={styles.introText}>{step.description}</Text>
        </View>
      </View>
    );
  };

  const renderTapCardStep = (step) => {
    return (
      <>
        {renderInstructionStep(step)}
        <View style={styles.tapIndicator}>
          <Ionicons name="hand-left" size={40} color="white" />
        </View>
        {renderJobCard()}
      </>
    );
  };

  const renderSuggestionsStep = (step) => {
    return (
      <View style={styles.cardInstructionContainer}>
        <Text style={styles.cardInstructionTitle}>Suggested Replies</Text>
        <ScrollView contentContainerStyle={styles.suggestionsContainer}>
          {exampleSuggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionButton}
              onPress={() => {
                console.log("Suggested reply selected:", suggestion);
                // Handle suggestion selection
              }}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderCurrentStep()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  stepContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionOuterContainer: {
    position: 'absolute',
    top: 80,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  instructionContainer: {
    width: '85%',
    backgroundColor: 'rgba(30, 58, 138, 0.9)',
    padding: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  instructionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    lineHeight: 22,
  },
  nextButton: {
    position: 'absolute',
    bottom: 80,
    backgroundColor: '#FF4081',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    zIndex: 1000,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepIndicators: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 40,
    zIndex: 1000,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginHorizontal: 4,
  },
  activeStepDot: {
    backgroundColor: 'white',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  skipButton: {
    position: 'absolute',
    left: -180,
    bottom: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    zIndex: 9999,
  },
  skipButtonText: {
    color: 'white',
    fontSize: 14,
  },
  cardContainer: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.9,
    maxHeight: SCREEN_HEIGHT * 0.6,
    top: SCREEN_HEIGHT * 0.22,
    alignSelf: 'center',
    zIndex: 100,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  card: {
    height: '100%',
    width: '100%',
  },
  cardGradient: {
    flex: 1,
  },
  contentCard: {
    backgroundColor: 'white',
    flex: 1,
    margin: 2,
    borderRadius: 15,
    padding: 16,
  },
  titleContainer: {
    marginBottom: 12,
  },
  jobTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 4,
  },
  companyBadge: {
    backgroundColor: '#e0e7ff',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 15,
    alignSelf: 'flex-start',
  },
  companyName: {
    fontSize: 14,
    color: '#3730a3',
    fontWeight: '500',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 8,
  },
  overviewText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  gridContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  gridItem: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  gridLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#334155',
  },
  weeklyPayContainer: {
    backgroundColor: '#e0e7ff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  weeklyPayLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4338ca',
    marginBottom: 2,
  },
  weeklyPayValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3730a3',
  },
  locationInfoContainer: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 6,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    marginBottom: 4,
  },
  travelTimesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  travelTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginVertical: 2,
  },
  travelTimeText: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 4,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skillBubble: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
  },
  skillText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  availabilityContainer: {
    marginTop: 5,
  },
  dayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginRight: 10,
    width: 90,
    alignItems: 'center',
  },
  dayChipAvailable: {
    backgroundColor: '#dcfce7',
  },
  dayText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dayTextAvailable: {
    color: '#166534',
  },
  timeSlotsContainer: {
    flex: 1,
  },
  timeSlot: {
    fontSize: 13,
    color: '#334155',
  },
  analysisContainer: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 6,
  },
  prosContainer: {
    marginBottom: 10,
  },
  proBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  proText: {
    fontSize: 13,
    color: '#166534',
    marginLeft: 6,
  },
  consContainer: {
    marginBottom: 6,
  },
  conBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  conText: {
    fontSize: 13,
    color: '#991b1b',
    marginLeft: 6,
  },
  swipeRightIndicator: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
  },
  swipeLeftIndicator: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
  },
  matchContainer: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.8,
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  matchDescription: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    marginBottom: 20,
  },
  matchImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
  },
  matchesListContainer: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.6,
    backgroundColor: 'white',
    borderRadius: 15,
    overflow: 'hidden',
  },
  matchesList: {
    padding: 15,
  },
  matchesTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 15,
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f0f9ff',
    marginBottom: 10,
    borderRadius: 10,
  },
  matchAvatarContainer: {
    marginRight: 10,
  },
  matchAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  matchInfo: {
    flex: 1,
  },
  matchName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
  },
  matchPosition: {
    fontSize: 14,
    color: '#64748b',
  },
  matchStatus: {
    padding: 4,
  },
  newMatch: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 'bold',
  },
  chatContainer: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.6,
    backgroundColor: 'white',
    borderRadius: 15,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  chatHeader: {
    backgroundColor: '#1e3a8a',
    padding: 15,
  },
  chatHeaderText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  messagesContainer: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f8fafc',
  },
  messageItem: {
    marginBottom: 15,
  },
  myMessageItem: {
    alignItems: 'flex-end',
  },
  theirMessage: {
    backgroundColor: '#e0e7ff',
    padding: 10,
    borderRadius: 15,
    borderTopLeftRadius: 0,
    maxWidth: '80%',
  },
  myMessage: {
    backgroundColor: '#1e3a8a',
    padding: 10,
    borderRadius: 15,
    borderTopRightRadius: 0,
    maxWidth: '80%',
  },
  messageText: {
    color: '#1e3a8a',
    fontSize: 14,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 5,
    opacity: 0.7,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#1e3a8a',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  introContainer: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.9,
    padding: 25,
    backgroundColor: 'rgba(30, 58, 138, 0.9)',
    borderRadius: 15,
  },
  introContent: {
    alignItems: 'center',
  },
  introTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
    textAlign: 'center',
  },
  introText: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    lineHeight: 24,
  },
  tapIndicator: {
    position: 'absolute',
    zIndex: 1001,
    top: SCREEN_HEIGHT * 0.4,
    right: SCREEN_WIDTH * 0.3,
  },
  cardInstructionContainer: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(30, 58, 138, 0.9)',
    padding: 20,
    borderRadius: 15,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    maxWidth: SCREEN_WIDTH - 40,
  },
  swipeHintContainer: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.65, // Position below the card
    alignSelf: 'center',
    zIndex: 100,
  },
  swipeHintText: {
    fontSize: 16,
    color: 'white',
    backgroundColor: 'rgba(30, 58, 138, 0.7)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    textAlign: 'center',
  },
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchesScreenContainer: {
    position: 'absolute',
    width: 330,
    height: 400,
    backgroundColor: 'white',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
    top: SCREEN_HEIGHT * 0.15,
    left: '50%',
    marginLeft: -165,
    zIndex: 100,
  },
  matchesHeader: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#2563eb',
  },
  matchesHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  matchItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  companyIconContainer: {
    marginRight: 10,
  },
  matchItemDetails: {
    flex: 1,
  },
  matchCompanyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  matchJobTitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  matchLocation: {
    fontSize: 14,
    color: '#6b7280',
  },
  lastMessage: {
    flex: 1,
  },
  lastMessageText: {
    fontSize: 14,
    color: '#6b7280',
  },
});

const matchesStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.15,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#2563eb',
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#bfdbfe',
    textAlign: 'center',
    marginBottom: 16,
    maxWidth: 300,
  },
  matchCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    opacity: 0.75,
  },
  matchCount: {
    color: '#ffffff',
    fontSize: 14,
  },
  stickyHeader: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 10,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#ffffff',
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  activeFilter: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#ffffff',
  },
  scrollContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  matchItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  matchContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  matchHeader: {
    flex: 1,
  },
  iconTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  userInfo: {
    marginBottom: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  locationText: {
    fontSize: 14,
    color: '#6b7280',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  lastMessage: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  acceptedMatch: {
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  acceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  acceptedText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '600',
  },
  chevronContainer: {
    marginLeft: 12,
  },
});

const matchStyles = StyleSheet.create({
  matchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,  // Very high z-index to be on top
  },
  matchContainer: {
    width: '90%',
    maxWidth: 360,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  matchGradient: {
    width: '100%',
    height: '100%',
    padding: 2,  // Added padding to make the gradient border visible
  },
  matchContent: {
    backgroundColor: '#fff',
    margin: 2,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
  },
  matchTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 8,
  },
  matchSubtitle: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 24,
  },
  profilesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  profileCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userProfileImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  companyProfileImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#0891b2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInitials: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  companyInitials: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  matchIconContainer: {
    marginHorizontal: 12,
  },
  matchInfoContainer: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  matchDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  matchDetailText: {
    fontSize: 16,
    color: '#334155',
    marginLeft: 12,
  },
  actionButtonsContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#1e3a8a',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '600',
  },
});

const matchModalStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.9,
    height: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    right: 15,
    top: 15,
    zIndex: 1,
    padding: 5,
  },
  closeButtonText: {
    fontSize: 28,
    color: '#666',
  },
  matchTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
    color: '#333',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#fff',
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  activeTab: {
    backgroundColor: '#185ee0',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  contentContainer: {
    flex: 1,
  },
  detailsContent: {
    flex: 1,
    padding: 15,
  },
  detailsSection: {
    marginBottom: 20,
  },
  jobTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  companyName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 16,
    color: '#555',
    lineHeight: 22,
    marginBottom: 8,
  },
  scheduleItem: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    marginTop: 4,
  },
  buttonContainer: {
    marginTop: 10,
    marginBottom: 30,
    alignItems: 'center',
  },
  messageButton: {
    backgroundColor: '#185ee0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    width: '80%',
  },
  messageButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

const chatStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    display: 'flex',
    flexDirection: 'column',
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  avatarContainer: {
    marginRight: 10,
  },
  companyAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0891b2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  messageBubble: {
    maxWidth: '75%',
    backgroundColor: 'white',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
    alignSelf: 'flex-end',
  },
  dayDivider: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dayDividerText: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  suggestionsContainer: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: 'white',
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  suggestionsScroll: {
    flexDirection: 'row',
    paddingBottom: 5,
  },
  suggestionBubble: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  suggestionText: {
    fontSize: 14,
    color: '#334155',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sendButton: {
    width: 36,
    height: 36,
    backgroundColor: '#1e3a8a',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
});

export default TutorialOverlay; 
