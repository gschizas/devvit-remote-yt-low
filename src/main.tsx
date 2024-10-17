import {Devvit, SettingScope} from '@devvit/public-api';

Devvit.configure({
    redditAPI: true,
    http: true,
});

Devvit.addSettings([
    {
        name: 'youtube-api-key',
        label: 'YouTube API Key',
        type: 'string',
        scope: SettingScope.Installation,
    },
    {
        name: 'minimum-subscribers',
        label: 'Minimum Subscribers to allow video submission',
        type: 'number',
        scope: SettingScope.Installation,
    },
]);

Devvit.addTrigger({
    event: 'PostSubmit',
    onEvent: async (event, context) => {
        console.log(`Received OnPostSubmit event:\n${JSON.stringify(event)}`);
        console.log(`Received OnPostSubmit context:\n${JSON.stringify(context)}`);

        console.log(`Author URL: ${event?.post?.media?.oembed?.authorUrl}`);
        const authorUrl = event?.post?.media?.oembed?.authorUrl;
        const authorId = authorUrl?.split('@').pop();
        const postId = event?.post?.id;
        console.log(`Author ID: ${authorId}`);
        if (!authorId) {
            console.error('Could not retrieve author Id');
            return;
        }
        if (!postId) {
            console.error('Could not retrieve post Id');
            return;
        }

        const minimumSubscribersRaw: number | undefined = await context.settings.get('minimum-subscribers');
        if (minimumSubscribersRaw == undefined) {
            console.error('Minimum subscribers is not set');
            return;
        }
        let minimumSubscribers: number;
        // @ts-ignore
        minimumSubscribers = minimumSubscribersRaw;
        console.log(`Minimum Subscribers: ${minimumSubscribers}`);

        const apiKey: string | undefined = await context.settings.get('youtube-api-key');
        console.log(apiKey);
        if (!apiKey) {
            console.error('YouTube API Key is not set');
            return;
        }

        const params = new URLSearchParams({
            part: 'statistics',
            forHandle: authorId,
            key: apiKey
        });
        const request = new Request('https://youtube.googleapis.com/youtube/v3/channels?' + params);

        const response = await fetch(request);
        if (!response.ok) {
            throw new Error("Network response was not OK");
        }

        const resp = response;
        const respText = await resp.text();
        console.log(respText);
        const data = await resp.json();
        console.log(data);
        if (data.pageInfo.totalResults != 1) {
            throw new Error('There should be exactly one result');
        }
        if (data.items[0].statistics.hiddenSubscriberCount) {
            throw new Error('Hidden subscriber count');
        }
        const subscriberCount: number = data.items[0].statistics.subscriberCount;
        if (subscriberCount < minimumSubscribers) {
            console.log(`Subscriber count is too low: ${subscriberCount} < ${minimumSubscribers}`);
            const message = `This YouTube channel has ${subscriberCount} subscribers. To submit videos, you need at least ${minimumSubscribers} subscribers.`;
            await context.reddit.addRemovalNote({
                itemIds: [postId],
                reasonId: '',
                modNote: message
            });
            await context.reddit.remove(postId, false);
        }
    },
});

export default Devvit;
