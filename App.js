Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    weeks : [],
    numberOfWeeks : 16,
    arrOfCreationDateFilters : [],
    arrOfFixedAndLimitedByCreationDateFilters : [],
    created : [],
    fixedWithinTTR : [],
    launch: function() {
        this._myMask = new Ext.LoadMask(Ext.getBody(), {msg:"Please wait.This may take long..."});
        this._myMask.show();
        this.getDates();
        this.createFilters();
        this.makeStore();
    },
    getDates:function(){
        var now = new Date(),
            today = now.getDay(),
            saturday = 6,
            ttr = 4,
            padding = 1,
            howFarBack = this.numberOfWeeks + padding,
            saturdayDates = [],
            closestSaturday = null,
            prevSaturday = null,
            weeks = [];
        var daysFromLastSaturday = today - saturday;
        closestPastSaturday = new Date(now - daysFromLastSaturday*86400000 - 7*86400000);
        saturdayDates.push(Rally.util.DateTime.format(closestPastSaturday, 'Y-m-d'));
        console.log('today:', today, 'daysFromLastSaturday:',daysFromLastSaturday, 'closestPastSaturday:',closestPastSaturday);
        for(var i=1;i<howFarBack;i++){
            var prevSaturday = new Date(closestPastSaturday - 7*86400000);
            saturdayDates.push(Rally.util.DateTime.format(prevSaturday, 'Y-m-d'));
            closestPastSaturday = prevSaturday;
             
        }
        console.log('saturdayDates:',saturdayDates);
        
        for (var i=0; i<saturdayDates.length-1; i++) {
            var week = {};
            week['end'] = saturdayDates[i];
            week['start'] = saturdayDates[i+1];
            this.weeks.push(week);
        }
        _.each(this.weeks, function(week){
            console.log('start:', week.start, 'end:', week.end);
        });
        console.log('--------', weeks.length);
    },
    createFilters:function(){
        var tagFilter;
        var codeResolitionFilter;
        var closedFilter;
        var fixedFilter;
        var closedDateFilters = [];
        var creationDateFilters = [];
        
        tagFilter = Ext.create('Rally.data.wsapi.Filter', {
             property : 'Tags.Name',
             operator: 'contains',
             value: 'Customer Voice'
        });
        
        closedFilter = tagFilter.and(Ext.create('Rally.data.wsapi.Filter', {
            property : 'State',
	    value: 'Closed'
        }));
        
        codeResolitionFilter = Rally.data.wsapi.Filter.or([
            {
		property : 'Resolution',
		value : 'Code Change'
	    },
	    {
		property : 'Resolution',
		value : 'Database/Metadata Change'
	    },
	    {
		property : 'Resolution',
		value: 'Configuration Change'
	    }
        ]);
        
        fixedFilter = closedFilter.and(codeResolitionFilter);
        
        _.each(this.weeks, function(week){
            var creationDateFilter = Rally.data.wsapi.Filter.and([
                {
                    property : 'CreationDate',
                    operator : '>=',
                    value : week['start']
                },
                {
                    property : 'CreationDate',
                    operator : '<',
                    value : week['end']
                }
            ]);
            this.arrOfCreationDateFilters.push(tagFilter.and(creationDateFilter));
            this.arrOfFixedAndLimitedByCreationDateFilters.push(fixedFilter.and(creationDateFilter));
        },this);
        
        console.log(this.arrOfCreationDateFilters.length, ' Creation Date Filters--------');
        _.each(this.arrOfCreationDateFilters, function(filter){
            console.log(filter.toString());
        },this);
        console.log(this.arrOfFixedAndLimitedByCreationDateFilters.length, ' Fixed Filters limited by Creation Dates-----------');
        _.each(this.arrOfFixedAndLimitedByCreationDateFilters, function(filter){
            console.log(filter.toString());
        },this);
    },
    
    makeStore:function(){
        this.concatArraysOfFilters = this.arrOfCreationDateFilters.concat(
            this.arrOfFixedAndLimitedByCreationDateFilters); //turn into one array of 24 filters
        this.defectStore = Ext.create('Rally.data.wsapi.Store',{
            model: 'Defect',
            fetch: ['Name','State','FormattedID','CreationDate','ClosedDate'],
            limit: Infinity
        });
        this.applyFiltersToStore(0);
    },
    
    applyFiltersToStore:function(i){
        this.defectStore.addFilter(this.concatArraysOfFilters[i]);
        this.defectStore.load({
            scope: this,
            callback: function(records, operation) {
                if(operation.wasSuccessful()) {
                    //console.log('records.length',records.length);
                    if (i<this.numberOfWeeks) { //first 12 are creation date filters,include open & closed bugs
                        this.created.push(records.length);
                    }
                    else{
                        this.fixedWithinTTR.push(this.getFixedDefectsWithinTTR(records));
                    }
                    this.defectStore.clearFilter(records.length);
                    if (i < this.concatArraysOfFilters.length-1) { //if not done, call itself
                        this.applyFiltersToStore(i + 1);
                    }
                    else{
                        this.makeCustomStore();
                    }
                }
            }
        });
    },
    getFixedDefectsWithinTTR:function(records){
        var ttr4 = 28; //4 weeks
        var ttr12 = 84; //12 weeks
        var closedDefectWithinTTRCount = [];
        var arrayOfDataObjects = [];
        _.each(records, function(record){
            var created = new Date(record.get('CreationDate'));
            var closed = new Date(record.get('ClosedDate'));
            //console.log(record.get('FormattedID'));
            //console.log('created',created);
            //console.log('closed',closed);
            var diff = Math.floor((closed - created)/86400000); 
            //console.log('diff', diff);
            if (diff <= ttr4) {
                closedDefectWithinTTRCount.push(record);
            }
        },this);
        return closedDefectWithinTTRCount.length;
    },
    makeCustomStore:function(){
        console.log('created',this.created);
        console.log('fixedWithinTTR',this.fixedWithinTTR);
        
        var startDates = [];
        var endDates = [];
        var dri = [];
        var combinedArr = [];
        var dimention = 4;
        for(var f = 0, c=0; f<this.fixedWithinTTR.length; f++,c++){
                dri.push((this.fixedWithinTTR[f]/this.created[c]*100).toFixed(2) + '%');
        }
        combinedArr.push(this.created);
        combinedArr.push(this.fixedWithinTTR);
        combinedArr.push(dri);
        combinedArr.push(startDates);
        combinedArr.push(endDates);
        _.each(this.weeks, function(week){
            startDates.push(week.start);
            endDates.push(week.end);
        });
        console.log(combinedArr);
        var zippedChunks = _.zip(combinedArr);
        console.log('zippedChunks',zippedChunks);
        var arrayOfObjects = [];
        for(var i = 0;i<zippedChunks.length;i++){
            var o = {};
            for(var j=0; j<zippedChunks[i].length;j++){
                o[j] = zippedChunks[i][j];
            }
            arrayOfObjects.push(o);
        }
        
        console.log('arrayOfObjects', arrayOfObjects);
        this.makeGrid(arrayOfObjects);
    },
    makeGrid:function(data){
        this._myMask.hide();
        this.add({
            xtype: 'rallygrid',
            itemId: 'defectGrid',
            store: Ext.create('Rally.data.custom.Store', {
                data: data
            }),
            columnCfgs: [
                {
                    text: 'Start Week',
                    dataIndex: '3'
                },
                {
                    text: 'End Week',
                    dataIndex: '4'
                },
                {
                    text: 'Created Defects',
                    dataIndex: '0'
                },
                {
                    text: 'Fixed Defect',
                    dataIndex: '1'
                },
                {
                    text: '4 Week DRI',
                    dataIndex: '2'
                }
            ],
            showPagingToolbar:false
        });
    }
});
