import { LightningElement, track, wire,api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import LightningConfirm from 'lightning/confirm';
import { getObjectInfo, getPicklistValuesByRecordType } from 'lightning/uiObjectInfoApi';
import LEAD_OBJECT from '@salesforce/schema/Lead';
import getInitialData from '@salesforce/apex/JSWLeadCreationController.getInitialData';
import validateTerritory from '@salesforce/apex/JSWLeadCreationController.validateTerritory';
import getTerritoryUserSuggestion from '@salesforce/apex/JSWLeadCreationController.getTerritoryUserSuggestion';
import createLead from '@salesforce/apex/JSWLeadCreationController.createLead';
import LABEL_DEFAULT_COUNTRY_CODE from '@salesforce/label/c.SFA_PJT_DefaultCountryCode';
import LABEL_ASSIGNMENT_TYPE_LEAD from '@salesforce/label/c.SFA_PJT_AssignmentTypeLead';
import LABEL_DEFAULT_LEAD_ACCOUNT_TYPE from '@salesforce/label/c.SFA_PJT_DefaultLeadAccountType';
import LABEL_LEAD_SOURCE_CONTRACTOR from '@salesforce/label/c.SFA_PJT_LeadSourceContractorRecommended';
import LABEL_LEAD_SOURCE_DEALER from '@salesforce/label/c.SFA_PJT_LeadSourceDealerRecommended';
import LABEL_LEAD_SOURCE_SPECIFIER from '@salesforce/label/c.SFA_PJT_LeadSourceSpecifierRecommended';
import LABEL_DEFAULT_LEAD_TYPE from '@salesforce/label/c.SFA_PJT_DefaultLeadType';
import LABEL_CONFIRM_SAVE_TITLE from '@salesforce/label/c.SFA_PJT_ConfirmSaveTitle';
import LABEL_CONFIRM_SAVE_MESSAGE from '@salesforce/label/c.SFA_PJT_ConfirmSaveLeadDetailsMessage';
import LABEL_TERRITORY_NOT_FOUND_TITLE from '@salesforce/label/c.SFA_PJT_TerritoryMappingNotFoundTitle';
import LABEL_TERRITORY_NOT_FOUND_MESSAGE from '@salesforce/label/c.SFA_PJT_TerritoryMappingNotFoundMessage';
import LABEL_TOAST_ERROR_TITLE from '@salesforce/label/c.SFA_PJT_ToastErrorTitle';
import LABEL_TOAST_SUCCESS_TITLE from '@salesforce/label/c.SFA_PJT_ToastSuccessTitle';
import LABEL_TOAST_VALIDATION_TITLE from '@salesforce/label/c.SFA_PJT_ToastValidationErrorTitle';
import LABEL_SHARING_REQUIRED from '@salesforce/label/c.SFA_PJT_SharingBandRequiredForCoOwnerFlowMessage';
import LABEL_COOWNER_REQUIRED from '@salesforce/label/c.SFA_PJT_CoOwnerSuggestionRequiredMessage';
import LABEL_LEAD_CREATED_SUCCESS from '@salesforce/label/c.SFA_PJT_LeadCreatedSuccessMessage';
import LABEL_MOBILE_TEN_DIGITS from '@salesforce/label/c.SFA_PJT_MobileNumberTenDigitsMessage';
import LABEL_CONTACT_TEN_DIGITS from '@salesforce/label/c.SFA_PJT_ContactNumberTenDigitsMessage';
import LABEL_VALID_EMAIL from '@salesforce/label/c.SFA_PJT_ValidEmailRequiredMessage';
import LABEL_POSTAL_MIN_DIGITS from '@salesforce/label/c.SFA_PJT_PostalCodeMinDigitsMessage';
import LABEL_CONTRACTOR_REQUIRED from '@salesforce/label/c.SFA_PJT_ContractorRequiredForLeadSourceMessage';
import LABEL_DEALER_REQUIRED from '@salesforce/label/c.SFA_PJT_DealerRequiredForLeadSourceMessage';
import LABEL_SPECIFIER_REQUIRED from '@salesforce/label/c.SFA_PJT_SpecifierRequiredForLeadSourceMessage';
import runningUserId from '@salesforce/user/Id';

export default class JswLeadCreation extends NavigationMixin(LightningElement) {
    @api recordTypeId;
    @api recordTypeName;
    @api launchContextRef;
    defaultCountryCode = LABEL_DEFAULT_COUNTRY_CODE;
    defaultAssignmentType = LABEL_ASSIGNMENT_TYPE_LEAD;
    defaultLeadAccountType = LABEL_DEFAULT_LEAD_ACCOUNT_TYPE;
    leadSourceContractorRecommended = LABEL_LEAD_SOURCE_CONTRACTOR;
    leadSourceDealerRecommended = LABEL_LEAD_SOURCE_DEALER;
    leadSourceSpecifierRecommended = LABEL_LEAD_SOURCE_SPECIFIER;

    @track formData = {};

    @track isLoading = false;
    @track isModalOpen = true;
    @track showTerritoryWarningModal = false;
    @track showSharingModal = false;
    @track suggestedCoOwnerName = '';
    @track suggestedCoOwnerId = null;
    @track coOwnerSuggestionMessage = '';
    @track isUnmappedTerritory = false;
    @track isProjectSalesOfficer = false;
    @track territoryAssignmentId = null;
    @track territorySfId = null;

    //leadTypeOptions = [];
    leadSourceOptions = [];
    segmentTypeOptions = [];
    stateOptions = [];
    sharingBandOptions = [];
    isKeyAccountOptions = [];

    dealerRecordTypeId;
    contractorRecordTypeId;
    specifierRecordTypeId;
    keyAccountRecordTypeId;
    otherKeyAccountId;

    leadRecordTypeId;

    connectedCallback() {
        this.initializeFormState();
        this.loadInitialData();
    }

    disconnectedCallback() {
        this.resetFormAndUiState();
    }

    // called by the Aura wrapper when it reuses this instance instead of remounting it (e.g. mobile Cancel -> New)
    @api
    reopen() {
        this.initializeFormState();
    }

    @wire(getObjectInfo, { objectApiName: LEAD_OBJECT })
    handleLeadObjectInfo({ data, error }) {
        if (data) {
            const recordTypes = Object.values(data.recordTypeInfos);

            // Find Project Site record type by label
            const projectSiteRt = recordTypes.find(
                rt => rt.name === 'Project Site'
            );

            this.leadRecordTypeId = projectSiteRt
                ? projectSiteRt.recordTypeId
                : data.defaultRecordTypeId;
        } else if (error) {
            this.showToast('Error', this.getErrorMessage(error), 'error');
        }
    }

    @wire(getPicklistValuesByRecordType, { objectApiName: LEAD_OBJECT, recordTypeId: '$leadRecordTypeId' })
    handleLeadPicklistValues({ data, error }) {
        if (data) {
            this.stateOptions = this.buildStateOptionsForCountry(data, this.defaultCountryCode);
        
            this.leadSourceOptions =
            data.picklistFieldValues.LeadSource.values.map(item => ({
                label: item.label,
                value: item.value
            }));

            this.segmentTypeOptions =
            data.picklistFieldValues.SegmentType__c.values.map(item => ({
                label: item.label,
                value: item.value
            }));

            this.sharingBandOptions =
            data.picklistFieldValues.SharingPercentageBand__c.values.map(item => ({
                label: item.label,
                value: item.value
            }));

            this.isKeyAccountOptions =
            data.picklistFieldValues.IsKeyAccount__c.values.map(item => ({
                label: item.label,
                value: item.value
            }));

            /* this.leadTypeOptions =
            data.picklistFieldValues.LeadType__c.values.map(item => ({
                label: item.label,
                value: item.value
            })); */
        
        } else if (error) {
            this.showToast('Error', this.getErrorMessage(error), 'error');
        }
    }

    get accountMatchingInfo() {
        return {
            primaryField: { fieldPath: 'Name' }
        };
    }

    get accountDisplayInfo() {
        return {
            additionalFields: ['RecordType.Name']
        };
    }

    get dealerFilter() {
        return this.buildRecordTypeFilter(this.dealerRecordTypeId);
    }

    get contractorFilter() {
        return this.buildRecordTypeFilter(this.contractorRecordTypeId);
    }

    get specifierFilter() {
        return this.buildRecordTypeFilter(this.specifierRecordTypeId);
    }

    get keyParentProjectFilter() {
        if (!this.keyAccountRecordTypeId) {
            return null;
        }

        return {
            criteria: [
                {
                    fieldPath: 'RecordTypeId',
                    operator: 'eq',
                    value: this.keyAccountRecordTypeId
                },
                {
                    fieldPath: 'KeyAccountType__c',
                    operator: 'eq',
                    value: 'Projects Sales'
                },
                {
                    fieldPath: 'AccountStatus__c',
                    operator: 'eq',
                    value: 'Active'
                },
                {
                    fieldPath: 'SegmentType__c',
                    operator: 'eq',
                    value: this.formData.segmentType || ''
                }
            ],
            filterLogic: '1 AND 2 AND 3 AND 4'
        };
    }

    get showProjectSections() {
        return (this.formData.leadType || '').toLowerCase() === 'project site';
    }

    get normalizedLeadSource() {
        return (this.formData.leadSource || '').trim().toLowerCase();
    }

    get isContractorRequired() {
        return this.normalizedLeadSource === this.leadSourceContractorRecommended;
    }

    get isDealerRequired() {
        return this.normalizedLeadSource === this.leadSourceDealerRecommended;
    }

    get isSpecifierRequired() {
        return this.normalizedLeadSource === this.leadSourceSpecifierRecommended;
    }

    get isKeyParentProjectVisible() {
        return this.formData.isKeyAccount === 'Yes' || this.isGovernmentSegment;
    }

    get isKeyParentProjectRequired() {
        return this.formData.isKeyAccount === 'Yes';
    }

    get isOtherKeyAccountRequired() {
        return this.formData.isKeyAccount === 'Yes - Other';
    }

    get isKeyAccountSelectionDisabled() {
        return this.isRepaintingSegment || this.isGovernmentSegment;
    }

    get isOtherKeyAccountVisible() {
        return this.formData.isKeyAccount === 'Yes - Other';
    }

    get isRepaintingSegment() {
        return (this.formData.segmentType || '').trim().toLowerCase() === 're-painting';
    }

    get isGovernmentSegment() {
        return (this.formData.segmentType || '').trim().toLowerCase() === 'government';
    }

    get hasSuggestedCoOwner() {
        return !!this.suggestedCoOwnerId && !!this.suggestedCoOwnerName;
    }

    get saveDisabled() {
        return this.isLoading;
    }

    get shareSaveDisabled() {
        return this.isLoading;
    }
    

    createDefaultFormData() {
        return {
            leadType: LABEL_DEFAULT_LEAD_TYPE,
            company: '',
            firstName: '',
            lastName: '',
            phone: '',
            mobilePhone: '',
            email: '',
            leadSource: '',
            isKeyAccount: 'No',
            keyParentProjectId: null,
            otherKeyAccount: '',
            dealerId: null,
            contractorId: null,
            specifierId: null,
            contactNumber: '',
            segmentType: '',
            city: '',
            district: '',
            stateCode: '',
            street: '',
            landmark: '',
            postalCode: '',
            sharingPercentageBand: ''
        };
    }

    initializeFormState() {
        this.formData = this.createDefaultFormData();
        this.isModalOpen = true;
        this.clearSuggestion();
        this.showTerritoryWarningModal = false;
        this.showSharingModal = false;
    }

    resetFormAndUiState() {
        this.formData = this.createDefaultFormData();
        this.showTerritoryWarningModal = false;
        this.showSharingModal = false;
        this.isModalOpen = false;
        this.clearSuggestion();
    }

    buildRecordTypeFilter(recordTypeId) {
        if (!recordTypeId) {
            return null;
        }

        return {
            criteria: [
                {
                    fieldPath: 'RecordTypeId',
                    operator: 'eq',
                    value: recordTypeId
                }
            ]
        };
    }

    async loadInitialData() {
        this.isLoading = true;
        try {
            const data = await getInitialData();
            this.dealerRecordTypeId = data?.dealerRecordTypeId;
            this.contractorRecordTypeId = data?.contractorRecordTypeId;
            this.specifierRecordTypeId = data?.specifierRecordTypeId;
            this.keyAccountRecordTypeId = data?.keyAccountRecordTypeId;
            this.otherKeyAccountId = data?.otherKeyAccountId;
            this.isProjectSalesOfficer = data?.isProjectSalesOfficer === true;

            this.formData = {
                ...this.formData,
                leadType: data?.defaultLeadType || LABEL_DEFAULT_LEAD_TYPE
            };
        } catch (error) {
            this.showToast(LABEL_TOAST_ERROR_TITLE, this.getErrorMessage(error), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    handleInputChange(event) {
        const { name, value } = event.target;
        this.formData = {
            ...this.formData,
            [name]: value
        };

        if (name === 'segmentType' && this.isGovernmentSegment) {
            this.formData = {
                ...this.formData,
                isKeyAccount: 'Yes',
                keyParentProjectId: null,
                otherKeyAccount: ''
            };
        } else if (name === 'segmentType' && this.isRepaintingSegment) {
            this.formData = {
                ...this.formData,
                isKeyAccount: 'Yes',
                keyParentProjectId: this.otherKeyAccountId,
                otherKeyAccount: ''
            };
        } else if (name === 'segmentType') {
            this.formData = {
                ...this.formData,
                isKeyAccount: 'No',
                keyParentProjectId: null,
                otherKeyAccount: ''
            };
        }

        if (name === 'leadSource') {
            Promise.resolve().then(() => {
                this.refreshConditionalPickerValidity();
            });
        }

        if (name === 'isKeyAccount') {
            this.formData = {
                ...this.formData,
                keyParentProjectId: this.isKeyParentProjectVisible ? this.formData.keyParentProjectId : null,
                otherKeyAccount: this.isOtherKeyAccountVisible ? this.formData.otherKeyAccount : ''
            };
        }

        if (name === 'postalCode' || name === 'segmentType') {
            this.clearSuggestion();
        }

    }

    handleDealerChange(event) {
        this.formData = {
            ...this.formData,
            dealerId: event.detail.recordId || null
        };
    }

    handleContractorChange(event) {
        this.formData = {
            ...this.formData,
            contractorId: event.detail.recordId || null
        };
    }

    handleSpecifierChange(event) {
        this.formData = {
            ...this.formData,
            specifierId: event.detail.recordId || null
        };
    }

    handleKeyParentProjectChange(event) {
        this.formData = {
            ...this.formData,
            keyParentProjectId: event.detail.recordId || null
        };
    }

    async handleSave() {
        if (this.isLoading) {
            return;
        }
        this.syncFormDataFromInputs();
         if (!this.validateInputs()) {
            return;
        } 

        this.isLoading = true;
        this.territoryAssignmentId = null;
        this.territorySfId = null;
        try {
            const validation = await validateTerritory({
                leadType: this.formData.leadType,
                postalCode: this.formData.postalCode,
                segmentType: this.formData.segmentType
            });

            if (validation?.isValid) {
                this.territoryAssignmentId = validation.territoryAssignmentId;
                this.territorySfId = validation.territorySfId;
                let saveMessage = 'This lead matches your territory based on the selected PIN Code (' + this.formData.postalCode + ') and Segment (' + this.formData.segmentType + ').\n\n' +
                    'This lead will be pushed to your territory.\n\n' +
                    'Do you want to continue?';
                const confirmedSave = await LightningConfirm.open({
                        message: saveMessage,
                        variant: 'header',
                        label: LABEL_CONFIRM_SAVE_TITLE
                });

                if (confirmedSave) {
                    await this.saveLead(false,false,false);
                }
                return;
            } else {
                await this.loadCoOwnerSuggestion();

                if (this.isUnmappedTerritory) {         
                    let unmappedTerritoryMessage = 'No territory assignment was found for the entered Pin Code (' + this.formData.postalCode + ') and Segment (' + this.formData.segmentType + ').' +
                    'This Lead will be assigned to the Business Admin for review. Do you want to continue?';

                    const confirmed = await LightningConfirm.open({
                        message: unmappedTerritoryMessage,
                        variant: 'header',
                        label: LABEL_CONFIRM_SAVE_TITLE
                    });

                    if (confirmed) {
                        await this.saveLead(false, false,true);
                    }
                    return;
                }
                if (this.isProjectSalesOfficer) {
                    //this.showTerritoryWarningModal = true;
                    this.openTerritoryWarning();
                }
                else {
                    await this.saveLead(false,false,false);
                }
            }
        } catch (error) {
            console.error('Error during territory validation or lead creation:', error);
            let errorMessage = this.getErrorMessage(error);
            if (errorMessage.includes('Duplicate') || errorMessage.includes('duplicate') || errorMessage.includes('DUPLICATE') || errorMessage.includes('Use one of these records')) {
                const confirmedDuplicate = await LightningConfirm.open({
                    message: 'A duplicate lead was detected. Do you want to create a duplicate?',
                    variant: 'header',
                    label: LABEL_CONFIRM_SAVE_TITLE
                });

                if (confirmedDuplicate) {
                    await this.saveLead(false, false, this.isUnmappedTerritory, true);
                }
                return;
            }
            this.showToast(LABEL_TOAST_ERROR_TITLE, this.getErrorMessage(error), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    openTerritoryWarning() {
        this.isModalOpen = false;
        this.showTerritoryWarningModal = true;
        this.showSharingModal = false;
    }

    closeTerritoryWarning() {
        this.isModalOpen = true;
        this.showTerritoryWarningModal = false;
        this.showSharingModal = false;
    }

    openSharingModal() {
        this.isModalOpen = false;
        this.showTerritoryWarningModal = false;
        this.showSharingModal = true;
    }

    closeSharingModal() {
        this.isModalOpen = false;
        this.showTerritoryWarningModal = true;
        this.showSharingModal = false;
    }

    handleCancel() {
        this.navigateToLeadListView();
        this.resetFormAndUiState();
    }

    handleCloseModal() {
        this.handleCancel();
    }

    clearSuggestion() {
        this.suggestedCoOwnerName = '';
        this.suggestedCoOwnerId = null;
        this.coOwnerSuggestionMessage = '';
        this.isUnmappedTerritory = false;
        this.formData = {
            ...this.formData,
            sharingPercentageBand: ''
        };
    }

    async loadCoOwnerSuggestion() {
        this.clearSuggestion();
        try {
            const suggestion = await getTerritoryUserSuggestion({
                pincode: this.formData.postalCode,
                segment: this.formData.segmentType,
                track: null,
                typeOfAssignment: this.defaultAssignmentType,
                leadAccountType: this.defaultLeadAccountType
            });

            this.suggestedCoOwnerId = suggestion?.suggestedUserId || null;
            this.suggestedCoOwnerName = suggestion?.suggestedUserName || '';
            this.coOwnerSuggestionMessage = suggestion?.message || '';
            this.isUnmappedTerritory = suggestion?.isUnmappedTerritory === true;
            this.territoryAssignmentId = suggestion?.territoryAssignmentId || null;
            this.territorySfId = suggestion?.territorySfId || null;
        } catch (error) {
            this.coOwnerSuggestionMessage = this.getErrorMessage(error);
        }
    }

    async handleCoOwnerAssignSave() {
        this.handleCoOwnerSave(true);
    }

    async handleCoOwnerShareSave() {
        this.handleCoOwnerSave(false);
    }


    async handleCoOwnerSave(AssignToCoOwner = false) {
        if (this.isLoading) {
            return;
        }
        this.syncFormDataFromInputs();
        if (!this.formData.sharingPercentageBand && !AssignToCoOwner) {
            this.showToast(LABEL_TOAST_VALIDATION_TITLE, LABEL_SHARING_REQUIRED, 'error');
            return;
        }

        if (!this.suggestedCoOwnerId) {
            this.showToast(LABEL_TOAST_VALIDATION_TITLE, LABEL_COOWNER_REQUIRED, 'error');
            return;
        }

        let cosharringMessage;
        if(AssignToCoOwner){
            cosharringMessage = 'The entered PIN Code (' + this.formData.postalCode + ') and Segment (' + this.formData.segmentType + ') do not belong to your territory.\n\n' +
                        'The lead will be assigned to ' + this.suggestedCoOwnerName + '.\n\n' +
                        'Do you want to continue?';
        }
        else{
            cosharringMessage = 'The entered PIN Code (' + this.formData.postalCode + ') and Segment (' + this.formData.segmentType + ') do not belong to your territory.\n\n' +
                            'The lead will be created with ' + this.suggestedCoOwnerName + ' as the co-owner and a ' + this.formData.sharingPercentageBand + ' sharing allocation.\n\n' +
                            'Do you want to continue?';
        }

        const confirmed = await LightningConfirm.open({
            message: cosharringMessage,
            variant: 'header',
            label: LABEL_CONFIRM_SAVE_TITLE
        });
        cosharringMessage= null;
        if (!confirmed) {
            return;
        }

        this.isLoading = true;
        try {
            await this.saveLead(true,AssignToCoOwner,false);
            this.showSharingModal = false;
        } catch (error) {
            console.error(this.getErrorMessage(error));
            let errorMessage = this.getErrorMessage(error);
            if (errorMessage.includes('Duplicate') || errorMessage.includes('duplicate') || errorMessage.includes('DUPLICATE') || errorMessage.includes('Use one of these records') ) {
                // Handle duplicate error specifically if needed
                const confirmedDuplicate = await LightningConfirm.open({
                    message: 'A duplicate lead was detected. Do you want to create a duplicate?',
                    variant: 'header',
                    label: LABEL_CONFIRM_SAVE_TITLE
                });

                if (confirmedDuplicate) {
                    await this.saveLead(true,AssignToCoOwner,false,true);
                }
                return;
            }
            this.showToast(LABEL_TOAST_ERROR_TITLE, this.getErrorMessage(error), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async saveLead(shareWithCoOwner,AssignToCoOwner = false, assignToBusinessQueue = false, CreateDuplicate = false) {
        const requestData = this.buildCreateLeadRequest(shareWithCoOwner,AssignToCoOwner, assignToBusinessQueue, CreateDuplicate);
        const response = await createLead({
            requestData
        });

        this.showToast(LABEL_TOAST_SUCCESS_TITLE, LABEL_LEAD_CREATED_SUCCESS, 'success');

        console.log('AssignToCoOwner:', AssignToCoOwner);
        console.log('shareWithCoOwner:', shareWithCoOwner);
        console.log('assignToBusinessQueue:', assignToBusinessQueue);

        if (response?.leadId && response?.ownerId == runningUserId) {
            console.log('Lead created with ID: record page', response.leadId);
            // navigate before tearing down the modal so mobile's slower transition doesn't show a blank screen
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: response.leadId,
                    objectApiName: 'Lead',
                    actionName: 'view'
                }
            });
            this.resetFormAndUiState();
        }
        else {
            console.log('Lead created with ID List View:', response.leadId);
            this.navigateToLeadListView();
            this.resetFormAndUiState();
        }
    }

    validateInputs() {
        
        const allInputs = [...this.template.querySelectorAll('lightning-input, lightning-combobox, lightning-record-picker')];
        let isValid = allInputs.reduce((validSoFar, inputCmp) => {
            if (typeof inputCmp.reportValidity === 'function') {
                inputCmp.reportValidity();
            }
            if (typeof inputCmp.checkValidity === 'function') {
                return validSoFar && inputCmp.checkValidity();
            }
            return validSoFar;
        }, true);

        const companyValue = this.normalizeText(this.getInputValueByName('company') ?? this.formData.company);
        const companyInput = this.template.querySelector('lightning-input[name="company"]');
        if (companyInput) {
            companyInput.setCustomValidity(companyValue ? '' : 'Company is required.');
            companyInput.reportValidity();
        }
        if (!companyValue) {
            isValid = false;
        }

        if (this.formData.mobilePhone && !/^\d{10}$/.test(this.formData.mobilePhone)) {
            this.showToast(LABEL_TOAST_VALIDATION_TITLE, LABEL_MOBILE_TEN_DIGITS, 'error');
            isValid = false;
        }
        if (this.formData.contactNumber && !/^\d{10}$/.test(this.formData.contactNumber)) {
            this.showToast(LABEL_TOAST_VALIDATION_TITLE, LABEL_CONTACT_TEN_DIGITS, 'error');
            isValid = false;
        }
        if (this.formData.email && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(this.formData.email)) {
            this.showToast(LABEL_TOAST_VALIDATION_TITLE, LABEL_VALID_EMAIL, 'error');
            isValid = false;
        }

        const sanitizedPostal = (this.formData.postalCode || '').replace(/\D/g, '');
        if (sanitizedPostal.length < 6) {
            this.showToast(LABEL_TOAST_VALIDATION_TITLE, LABEL_POSTAL_MIN_DIGITS, 'error');
            isValid = false;
        }

        if (this.isContractorRequired && !this.formData.contractorId) {
            this.showToast(LABEL_TOAST_VALIDATION_TITLE, LABEL_CONTRACTOR_REQUIRED, 'error');
            isValid = false;
        }
        if (this.isDealerRequired && !this.formData.dealerId) {
            this.showToast(LABEL_TOAST_VALIDATION_TITLE, LABEL_DEALER_REQUIRED, 'error');
            isValid = false;
        }
        if (this.isSpecifierRequired && !this.formData.specifierId) {
            this.showToast(LABEL_TOAST_VALIDATION_TITLE, LABEL_SPECIFIER_REQUIRED, 'error');
            isValid = false;
        }
        if (this.isKeyParentProjectRequired && !this.formData.keyParentProjectId) {
            const message = this.isGovernmentSegment
                ? 'Select a Key Account.'
                : 'Select a Key Account.';
            this.showToast(LABEL_TOAST_VALIDATION_TITLE, message, 'error');
            isValid = false;
        }

        return isValid;
    }

    syncFormDataFromInputs() {
        const nextData = { ...this.formData };
        const allInputs = [...this.template.querySelectorAll('lightning-input, lightning-combobox')];

        allInputs.forEach((inputCmp) => {
            const fieldName = inputCmp.name;
            if (fieldName && Object.prototype.hasOwnProperty.call(nextData, fieldName)) {
                nextData[fieldName] = inputCmp.value;
            }
        });

        this.formData = nextData;
    }

    buildCreateLeadRequest(shareWithCoOwner, AssignToCoOwner = false, assignToBusinessQueue = false, CreateDuplicate = false) {
        return {
            recordTypeId: this.leadRecordTypeId,
            leadType: this.normalizeText(this.getInputValueByName('leadType') ?? this.formData.leadType),
            company: this.normalizeText(this.getInputValueByName('company') ?? this.formData.company),
            firstName: this.normalizeText(this.getInputValueByName('firstName') ?? this.formData.firstName),
            lastName: this.normalizeText(this.getInputValueByName('lastName') ?? this.formData.lastName),
            phone: this.normalizeText(this.getInputValueByName('phone') ?? this.formData.phone),
            mobilePhone: this.normalizeText(this.getInputValueByName('mobilePhone') ?? this.formData.mobilePhone),
            email: this.normalizeText(this.getInputValueByName('email') ?? this.formData.email),
            leadSource: this.normalizeText(this.getInputValueByName('leadSource') ?? this.formData.leadSource),
            isKeyAccount: this.normalizeText(this.getInputValueByName('isKeyAccount') ?? this.formData.isKeyAccount),
            keyParentProjectId: this.formData.keyParentProjectId,
            otherKeyAccount: this.normalizeText(this.getInputValueByName('otherKeyAccount') ?? this.formData.otherKeyAccount),
            dealerId: this.formData.dealerId,
            contractorId: this.formData.contractorId,
            specifierId: this.formData.specifierId,
            contactNumber: this.normalizeText(this.getInputValueByName('contactNumber') ?? this.formData.contactNumber),
            segmentType: this.normalizeText(this.getInputValueByName('segmentType') ?? this.formData.segmentType),
            city: this.normalizeText(this.getInputValueByName('city') ?? this.formData.city),
            district: this.normalizeText(this.getInputValueByName('district') ?? this.formData.district),
            stateCode: this.normalizeText(this.getInputValueByName('stateCode') ?? this.formData.stateCode),
            street: this.normalizeText(this.getInputValueByName('street') ?? this.formData.street),
            landmark: this.normalizeText(this.getInputValueByName('landmark') ?? this.formData.landmark),
            postalCode: this.normalizeText(this.getInputValueByName('postalCode') ?? this.formData.postalCode),
            sharingPercentageBand: this.normalizeText(this.getInputValueByName('sharingPercentageBand') ?? this.formData.sharingPercentageBand),
            shareWithCoOwner,
            suggestedCoOwnerId: this.suggestedCoOwnerId,
            track: null,
            typeOfAssignment: this.defaultAssignmentType,
            leadAccountType: this.defaultLeadAccountType,
            assignToBusinessQueue,
            territoryAssignmentId: this.territoryAssignmentId,
            territorySfId: this.territorySfId,
            leadId: null,
            AssignToCoOwner,
            CreateDuplicate: CreateDuplicate
        };
    }

    getInputValueByName(fieldName) {
        const field = this.template.querySelector(`[name="${fieldName}"]`);
        return field ? field.value : null;
    }

    normalizeText(value) {
        return value === null || value === undefined ? '' : String(value).trim();
    }

    buildStateOptionsForCountry(picklistData, countryCode) {
        const stateField = picklistData?.picklistFieldValues?.StateCode;
        if (!stateField) {
            return [];
        }

        const controllerValues = stateField.controllerValues || {};
        const controllingIndex = controllerValues[countryCode];
        if (controllingIndex === undefined || controllingIndex === null) {
            return [];
        }

        return (stateField.values || [])
            .filter((entry) => Array.isArray(entry.validFor) && entry.validFor.includes(controllingIndex))
            .map((entry) => ({ label: entry.label, value: entry.value }));
    }

    getErrorMessage(error) {
        if (!error) {
            return 'Unknown error';
        }
        if (error.body?.output?.errors?.length && error.body.output.errors[0].message) {
            return error.body.output.errors[0].message;
        }
        if (error.body?.output?.fieldErrors) {
            const fieldErrorKeys = Object.keys(error.body.output.fieldErrors);
            for (const key of fieldErrorKeys) {
                const fieldErrors = error.body.output.fieldErrors[key];
                if (Array.isArray(fieldErrors) && fieldErrors.length && fieldErrors[0].message) {
                    return fieldErrors[0].message;
                }
            }
        }
        if (error.body && Array.isArray(error.body) && error.body.length && error.body[0].message) {
            return error.body[0].message;
        }
        if (error.body && error.body.message) {
            return error.body.message;
        }
        return error.message || 'Unknown error';
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant,
                mode: 'dismissable'
            })
        );
    }

    refreshConditionalPickerValidity() {
        const selectors = ['[data-id="dealerPicker"]', '[data-id="contractorPicker"]', '[data-id="specifierPicker"]'];
        selectors.forEach((selector) => {
            const picker = this.template.querySelector(selector);
            if (picker && typeof picker.reportValidity === 'function') {
                picker.reportValidity();
            }
        });
    }

    navigateToLeadListView() {
        const listViewState = this.extractListViewStateFromContext();
        const navigationConfig = {
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'Lead',
                actionName: 'list'
            }
        };

        if (listViewState) {
            navigationConfig.state = listViewState;
        }

        this[NavigationMixin.Navigate](navigationConfig);
    }

    extractListViewStateFromContext() {
        if (!this.launchContextRef) {
            return { filterName: 'Recent' };
        }

        let contextRef = this.launchContextRef;
        if (contextRef.startsWith('1.')) {
            contextRef = contextRef.substring(2);
        }

        const padding = contextRef.length % 4;
        if (padding > 0) {
            contextRef += '='.repeat(4 - padding);
        }

        try {
            const decodedContext = JSON.parse(window.atob(contextRef));
            const state = decodedContext && decodedContext.state ? decodedContext.state : null;
            const filterName = state && state.filterName ? state.filterName : 'Recent';
            return { filterName };
        } catch (error) {
            return { filterName: 'Recent' };
        }
    }
}
