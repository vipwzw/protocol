import * as _ from 'lodash';

/**
 * 深度替换对象中的键
 */
export function replaceKeysDeep(
    obj: any,
    keyReplacements: { [oldKey: string]: string }
): any {
    if (_.isArray(obj)) {
        return obj.map(item => replaceKeysDeep(item, keyReplacements));
    }
    
    if (_.isObject(obj) && !_.isDate(obj) && !_.isFunction(obj)) {
        const result: any = {};
        
        for (const [key, value] of Object.entries(obj)) {
            const newKey = keyReplacements[key] || key;
            result[newKey] = replaceKeysDeep(value, keyReplacements);
        }
        
        return result;
    }
    
    return obj;
}

/**
 * 将多个数组进行短拉链操作（以最短数组长度为准）
 */
export function shortZip<T>(...arrays: T[][]): T[][] {
    if (arrays.length === 0) {
        return [];
    }
    
    const minLength = Math.min(...arrays.map(arr => arr.length));
    const result: T[][] = [];
    
    for (let i = 0; i < minLength; i++) {
        result.push(arrays.map(arr => arr[i]));
    }
    
    return result;
}

/**
 * 深度克隆对象
 */
export function deepClone<T>(obj: T): T {
    return _.cloneDeep(obj);
}

/**
 * 深度合并对象
 */
export function deepMerge<T>(target: T, ...sources: Partial<T>[]): T {
    return _.merge({}, target, ...sources);
}

/**
 * 安全获取嵌套属性
 */
export function safeGet(obj: any, path: string, defaultValue?: any): any {
    return _.get(obj, path, defaultValue);
}

/**
 * 安全设置嵌套属性
 */
export function safeSet(obj: any, path: string, value: any): void {
    _.set(obj, path, value);
}

/**
 * 检查对象是否为空
 */
export function isEmpty(value: any): boolean {
    return _.isEmpty(value);
}

/**
 * 数组去重
 */
export function uniq<T>(array: T[]): T[] {
    return _.uniq(array);
}

/**
 * 根据指定属性对对象数组去重
 */
export function uniqBy<T>(array: T[], iteratee: keyof T | ((item: T) => any)): T[] {
    return _.uniqBy(array, iteratee);
}

/**
 * 延迟执行
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 重试函数执行
 */
export async function retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000
): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            
            if (attempt < maxAttempts) {
                await delay(delayMs);
            }
        }
    }
    
    throw lastError!;
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): T {
    return _.throttle(func, wait) as unknown as T;
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): T {
    return _.debounce(func, wait) as unknown as T;
}