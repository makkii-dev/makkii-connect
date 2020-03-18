let id = 1;

export const genUID = (): string => {
    return `${id++}`;
};
