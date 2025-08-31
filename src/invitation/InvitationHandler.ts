export default class InvitationHandler {
    private connectionsModel: any;
    private instanceWrapper: any;

    constructor(connectionsModel: any, instanceWrapper: any) {
        this.connectionsModel = connectionsModel;
        this.instanceWrapper = instanceWrapper;
    }

    async acceptInvitation(invitationUrl: string): Promise<any> {
        try {
            console.log('[InvitationHandler] Processing invitation URL:', invitationUrl);
            
            // Parse the invitation URL
            const url = new URL(invitationUrl);
            const encodedData = url.searchParams.get('data');
            
            if (!encodedData) {
                throw new Error('No data parameter in invitation URL');
            }

            // Decode the invitation data
            const decodedData = decodeURIComponent(encodedData);
            
            // Try base64 decoding first, then regular JSON parsing
            let invitation: any;
            try {
                const base64Decoded = Buffer.from(decodedData, 'base64').toString('utf-8');
                invitation = JSON.parse(base64Decoded);
            } catch (base64Error) {
                // If base64 fails, try direct JSON parse
                invitation = JSON.parse(decodedData);
            }

            console.log('[InvitationHandler] Decoded invitation:', invitation);

            // Accept the invitation through the connections model
            if (this.connectionsModel && this.connectionsModel.acceptInvitation) {
                const result = await this.connectionsModel.acceptInvitation(invitation);
                console.log('[InvitationHandler] Invitation accepted:', result);
                return { success: true, result };
            } else if (this.connectionsModel && this.connectionsModel.createConnectionFromInvitation) {
                const result = await this.connectionsModel.createConnectionFromInvitation(invitation);
                console.log('[InvitationHandler] Connection created:', result);
                return { success: true, result };
            } else {
                // Try direct pairing token method
                if (invitation.pairingToken && this.instanceWrapper) {
                    const instance = this.instanceWrapper.get();
                    if (instance && instance.connectWithPairingToken) {
                        const result = await instance.connectWithPairingToken(invitation.pairingToken);
                        console.log('[InvitationHandler] Connected with pairing token:', result);
                        return { success: true, result };
                    }
                }
                
                throw new Error('No suitable method to accept invitation');
            }
        } catch (error: any) {
            console.error('[InvitationHandler] Error accepting invitation:', error);
            return { success: false, error: error.message };
        }
    }
}