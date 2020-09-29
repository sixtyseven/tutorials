export interface IEpgState {
    regions: {
        [id: string]: IEpgRegionState | undefined;
    };
}

const initialState: IEpgState = {
    regions: {},
};

export default function epgReducer(
    state = initialState,
    action: AllActions,
): IEpgState {
    switch (action.type) {
        case EPGS_LOADING:
            return {
                ...state,
                regions: {
                    ...state.regions,
                    [action.region]: {
                        channels: get(
                            state.regions,
                            [action.region, "channels"],
                            [],
                        ) as IEpgChannel[],
                        intervals: get(
                            state.regions,
                            [action.region, "intervals"],
                            [] as IInterval[],
                        ),
                        loading: true,
                    },
                },
            };

        case GET_EPGS: {
            const intervals = mergeIntervals(
                get(
                    state.regions,
                    [action.region, "intervals"],
                    [] as IInterval[],
                ),
                action.intervals,
            );
            const [{ start }] = intervals;
            const { end } = last(intervals)!;
            return {
                ...state,
                regions: {
                    ...state.regions,
                    [action.region]: {
                        ...state.regions[action.region],
                        channels: action.channels.map(channel => {
                            const newEpgIds = channel.epgs.map(({ id }) => id);
                            return {
                                ...channel,
                                // Fill any gaps in epgs with placeholders
                                epgs: epgsWithFilledGaps(
                                    channel,
                                    // Sort epgs by start
                                    sortBy(
                                        // Merge existing epgs for the current channel with new epgs from the action
                                        [
                                            // Get existing epgs for the channel from the action
                                            ...get(
                                                // Find channel that matches the current channel from the action
                                                find(
                                                    // Get all channels in the action region
                                                    get(
                                                        state.regions[
                                                            action.region
                                                        ],
                                                        ["channels"],
                                                        [] as IEpgChannel[],
                                                    ),
                                                    {
                                                        dvb_triplet:
                                                            channel.dvb_triplet,
                                                    },
                                                ),
                                                ["epgs"],
                                                [] as IEpgMaybePlaceholder[],
                                            )
                                                // Exclude placeholders, epgs with the same id as those in the action
                                                .filter(
                                                    epg =>
                                                        !epg._isPlaceholder &&
                                                        !newEpgIds.includes(
                                                            epg.id,
                                                        ),
                                                ),
                                            ...channel.epgs,
                                        ],
                                        "start",
                                    ),
                                    start,
                                    end,
                                ),
                            };
                        }),
                        intervals,
                        loading: false,
                    },
                },
            };
        }

        case SET_USER_REGION:
            return {
                ...state,
                regions: Object.entries(state.regions)
                    // Include only the current region, or regions that are currently loading
                    .filter(
                        ([region, regionState]) =>
                            region === action.id ||
                            (regionState && regionState.loading),
                    )
                    .reduce(
                        (acc, [region, regionState]) => ({
                            ...acc,
                            [region]: regionState,
                        }),
                        {} as { [region: string]: IEpgRegionState | undefined },
                    ),
            };

        default:
            return state;
    }
