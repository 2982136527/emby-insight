// Emby API Type Definitions

export interface EmbyUser {
    Id: string
    Name: string
    ServerId: string
    HasPassword: boolean
    HasConfiguredPassword: boolean
    HasConfiguredEasyPassword: boolean
    EnableAutoLogin: boolean
    LastLoginDate?: string
    LastActivityDate?: string
    Policy?: {
        IsAdministrator: boolean
        IsHidden: boolean
        IsDisabled: boolean
    }
    PrimaryImageTag?: string
}

export interface EmbySession {
    Id: string
    UserId: string
    UserName: string
    Client: string
    DeviceName: string
    DeviceId: string
    ApplicationVersion: string
    IsActive: boolean
    SupportsRemoteControl: boolean
    NowPlayingItem?: EmbyItem
    PlayState?: EmbyPlayState
    LastActivityDate: string
}

export interface EmbyPlayState {
    PositionTicks?: number
    CanSeek: boolean
    IsPaused: boolean
    IsMuted: boolean
    VolumeLevel?: number
    PlayMethod?: string
    RepeatMode?: string
}

export interface EmbyItem {
    Id: string
    Name: string
    ServerId: string
    Type: EmbyItemType
    MediaType?: string
    RunTimeTicks?: number
    ProductionYear?: number
    Genres?: string[]
    SeriesName?: string
    SeasonName?: string
    IndexNumber?: number // Episode number
    ParentIndexNumber?: number // Season number
    UserData?: EmbyUserData
    MediaSources?: EmbyMediaSource[]
    ImageTags?: {
        Primary?: string
        Backdrop?: string
    }
    Overview?: string
    OfficialRating?: string
    CommunityRating?: number
    CriticRating?: number
    DateCreated?: string
    PremiereDate?: string
    ProviderIds?: {
        Tmdb?: string
        Imdb?: string
        [key: string]: string | undefined
    }
}

export type EmbyItemType =
    | 'Movie'
    | 'Episode'
    | 'Series'
    | 'Season'
    | 'Audio'
    | 'MusicAlbum'
    | 'MusicArtist'
    | 'BoxSet'
    | 'Folder'

export interface EmbyUserData {
    PlaybackPositionTicks: number
    PlayCount: number
    IsFavorite: boolean
    Played: boolean
    LastPlayedDate?: string
    UnplayedItemCount?: number
}

export interface EmbyMediaSource {
    Id: string
    Name: string
    Path?: string
    Protocol: string
    Container: string
    Size?: number
    Bitrate?: number
    VideoType?: string
    MediaStreams?: EmbyMediaStream[]
}

export interface EmbyMediaStream {
    Codec: string
    Type: 'Video' | 'Audio' | 'Subtitle'
    Language?: string
    DisplayTitle?: string
    Index: number
    IsDefault: boolean
    IsForced: boolean
    Height?: number
    Width?: number
    BitRate?: number
    IsHDR?: boolean
    VideoRange?: string
    VideoRangeType?: string
}

export interface EmbyApiResponse<T> {
    Items: T[]
    TotalRecordCount: number
    StartIndex: number
}

export interface ItemQueryParams {
    StartIndex?: number
    Limit?: number
    SortBy?: string
    SortOrder?: 'Ascending' | 'Descending'
    IncludeItemTypes?: EmbyItemType[] | string
    Fields?: string[] | string
    Filters?: string[]
    Recursive?: boolean
    ParentId?: string
    IsPlayed?: boolean
}

export interface ServerConfig {
    id: string
    name: string
    url: string
    port: number
    apiKey: string
    isActive: boolean
}

// Utility functions
export function ticksToSeconds(ticks: number): number {
    return Math.floor(ticks / 10000000)
}

export function ticksToMinutes(ticks: number): number {
    return Math.floor(ticks / 10000000 / 60)
}

export function ticksToHours(ticks: number): number {
    // 返回精确小时数，保留2位小数
    return Math.round(ticks / 10000000 / 3600 * 100) / 100
}

export function formatDuration(ticks: number): string {
    const totalSeconds = ticksToSeconds(ticks)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)

    if (hours > 0) {
        return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
}

export function getResolutionFromStream(stream?: EmbyMediaStream): string | null {
    if (!stream?.Height) return null

    if (stream.Height >= 2160) return '4K'
    if (stream.Height >= 1080) return '1080P'
    if (stream.Height >= 720) return '720P'
    if (stream.Height >= 480) return '480P'
    return 'SD'
}
