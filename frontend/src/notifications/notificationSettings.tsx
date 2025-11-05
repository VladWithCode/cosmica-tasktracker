import { useEffect, useState } from "react";

// Component for notification settings
export function NotificationSettings() {
    const notifications = useNotifications();
    const { saveSubscription, removeSubscription } = useNotificationSubscription();
    const [vapidKey, setVapidKey] = useState<string>('');

    useEffect(() => {
        // Fetch VAPID public key from your backend
        fetch('/api/v1/notifications/vapid-key')
            .then(res => res.json())
            .then(data => setVapidKey(data.publicKey))
            .catch(console.error);
    }, []);

    const handleEnableNotifications = async () => {
        try {
            const subscription = await notifications.subscribe(vapidKey);
            await saveSubscription.mutateAsync(subscription);
            alert('Notifications enabled successfully!');
        } catch (error) {
            console.error('Error enabling notifications:', error);
            alert('Failed to enable notifications');
        }
    };

    const handleDisableNotifications = async () => {
        try {
            if (notifications.subscription) {
                await removeSubscription.mutateAsync(notifications.subscription.endpoint);
                await notifications.unsubscribe();
                alert('Notifications disabled');
            }
        } catch (error) {
            console.error('Error disabling notifications:', error);
            alert('Failed to disable notifications');
        }
    };

    if (!notifications.isSupported) {
        return (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                <p>Notifications are not supported in your browser.</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            <h3 className="text-lg font-semibold">Notification Settings</h3>

            <div className="space-y-2">
                <p className="text-sm text-gray-600">
                    Status: {notifications.isSubscribed ? 'Enabled' : 'Disabled'}
                </p>

                <p className="text-sm text-gray-600">
                    Permission: {notifications.permission}
                </p>
            </div>

            {!notifications.isSubscribed ? (
                <button
                    onClick={handleEnableNotifications}
                    disabled={saveSubscription.isPending}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                    {saveSubscription.isPending ? 'Enabling...' : 'Enable Notifications'}
                </button>
            ) : (
                <button
                    onClick={handleDisableNotifications}
                    disabled={removeSubscription.isPending}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                >
                    {removeSubscription.isPending ? 'Disabling...' : 'Disable Notifications'}
                </button>
            )}
        </div>
    );
}
