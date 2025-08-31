/**
 * Test script to demonstrate invitation acceptance functionality
 */

// Create a mock invitation URL for testing
const mockInvitationUrl = 'https://app.example.com/#eyJ0b2tlbiI6IjEyMzQ1NjEyMzQ1NiIsImVuZHBvaW50IjoiaHR0cHM6Ly9hcHAuZXhhbXBsZS5jb20iLCJwdWJsaWNLZXkiOiJhYmNkZWZhYmNkZWYxMjM0NTYxMjM0NTYiLCJ0eXBlIjoiaW9tIn0%3D';

import { InvitationHandler } from './lib/invitation/InvitationHandler.js';
import { getInstanceWrapper } from './lib/utils/InstanceWrapper.js';

async function testInvitationAcceptance() {
    console.log('🧪 Testing Invitation Acceptance Functionality');
    console.log('============================================');
    
    try {
        // Create mock objects for testing
        const mockState = {}; // Store callbacks here
        
        const mockConnectionsModel = {
            pairing: {
                onPairingSuccess: (callback) => {
                    console.log('📡 Pairing success listener set up');
                    // Store callback for later use
                    mockState.pairingSuccessCallback = callback;
                },
                onPairingFailed: (callback) => {
                    console.log('❌ Pairing failed listener set up');
                    // Store callback for later use
                    mockState.pairingFailedCallback = callback;
                },
                pair: async (invitation) => {
                    console.log('🤝 Initiating pairing with:', invitation);
                    // Simulate successful pairing after a short delay
                    setTimeout(() => {
                        if (mockState.pairingSuccessCallback) {
                            mockState.pairingSuccessCallback(
                                false, // initiatedLocally
                                'local-person-123', // localPersonId
                                'local-instance-123', // localInstanceId
                                'remote-person-456', // remotePersonId
                                'remote-instance-456', // remoteInstanceId
                                invitation.token // token
                            );
                        }
                    }, 100);
                }
            }
        };
        
        const mockIomManager = {
            requestManager: {
                createIoMRequest: async (localPersonId, remotePersonId, requestedPersonId, mode) => {
                    console.log('📋 Created IoM request:', {
                        localPersonId,
                        remotePersonId,
                        requestedPersonId,
                        mode
                    });
                }
            }
        };
        
        const mockInstance = getInstanceWrapper();
        
        // Create invitation handler
        const invitationHandler = new InvitationHandler(
            mockConnectionsModel,
            mockIomManager,
            mockInstance
        );
        
        console.log('✅ InvitationHandler created successfully');
        
        // Test URL parsing
        console.log('\n🔍 Testing invitation URL parsing...');
        const parsedInvitation = invitationHandler.parseInvitationUrl(mockInvitationUrl);
        console.log('📄 Parsed invitation:', parsedInvitation);
        
        if (parsedInvitation) {
            console.log('✅ URL parsing successful');
            console.log('   Token:', parsedInvitation.token);
            console.log('   Endpoint:', parsedInvitation.endpoint);
            console.log('   Public Key:', parsedInvitation.publicKey);
            console.log('   Type:', parsedInvitation.type);
        } else {
            console.log('❌ URL parsing failed');
            return;
        }
        
        // Test invitation acceptance
        console.log('\n🤝 Testing invitation acceptance...');
        try {
            const result = await invitationHandler.acceptInvitation(mockInvitationUrl);
            console.log('✅ Invitation accepted successfully!');
            console.log('📋 Result:', result);
        } catch (error) {
            console.log('❌ Invitation acceptance failed:', error.message);
        }
        
        // Test connection listing
        console.log('\n📊 Testing connection listing...');
        const connections = await invitationHandler.getActiveConnections();
        console.log('🔗 Active connections:', connections.length);
        
        console.log('\n🎉 Test completed successfully!');
        console.log('\nℹ️  In a real scenario, users would:');
        console.log('   1. Scan a QR code from another ONE app');
        console.log('   2. Write the invitation URL to /invites/accept/invitation.txt');
        console.log('   3. Check status in /invites/accept/status.txt');
        console.log('   4. View connections in /invites/connections.txt');
        
    } catch (error) {
        console.error('💥 Test failed with error:', error);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testInvitationAcceptance().catch(console.error);